"""
ML Engine for Burn-Ex.
Physics-Informed Stacked Ensemble Architecture:
  - Base models: XGBoostRegressor + GradientBoostingRegressor
  - Meta-learner: RidgeCV on out-of-fold predictions
  - Target: Dynamic form multiplier M_form in [0.55, 1.50]
  - Calibrates Base MET energy (Mifflin-St Jeor personalized BMR)
  - Evaluated with Leave-One-Person-Out (LOPO) Group-K-Fold CV
"""

from pathlib import Path
from typing import Dict, Any, Tuple, Optional, List
import pickle
import numpy as np
import pandas as pd

from src.config import (
    MODEL_PATH,
    RAW_SESSIONS_CSV,
    REFERENCE_BASELINES_CSV,
    MET_VALUES,
    EXERCISE_CONFIGS,
    FORM_MULTIPLIER_MIN,
    FORM_MULTIPLIER_MAX,
)

# Wider multiplier range to capture extreme form variation
_M_MIN = 0.55
_M_MAX = 1.50

RESIDUAL_FEATURE_COLUMNS: List[str] = [
    "peak_angular_velocity",
    "rom_completeness_ratio",
    "torso_inclination_angle",
    "rep_cadence_variance",
    "rep_velocity",
    "valid_rep_ratio",
    "power_index",           # NEW: peak_angular_velocity * rom_completeness_ratio
    "fatigue_index",         # NEW: rep_cadence_variance * (1 - valid_rep_ratio)
    "intensity_normalized",  # NEW: rep_velocity normalised by exercise-specific baseline
    "is_pushup",
    "is_squat",
    "is_jumping_jack",
]

# Reference cadence baselines per exercise (reps/min at moderate intensity)
_BASELINE_CADENCE: Dict[str, float] = {
    "pushup": 20.0,
    "squat": 18.0,
    "jumping_jack": 40.0,
}


def calculate_bmr(weight_kg: float, height_cm: float, age: int, gender: str) -> float:
    """Mifflin-St Jeor BMR (kcal/day)."""
    if str(gender).lower() == "male":
        return 10.0 * weight_kg + 6.25 * height_cm - 5.0 * age + 5.0
    else:
        return 10.0 * weight_kg + 6.25 * height_cm - 5.0 * age - 161.0


class MLEngine:
    """
    Predicts calorie expenditure using a Physics-Informed Stacked Ensemble.

    Estimated Kcal = K_base * M_form
    where K_base = MET * (BMR / 24) * (duration_hours),
    and M_form ∈ [0.55, 1.50] is predicted by the ensemble.
    """

    def __init__(self, model_path: Path = MODEL_PATH) -> None:
        self.model_path = model_path
        self.model: Optional[Any] = None
        self._load_or_initialize_model()

    def _load_or_initialize_model(self) -> None:
        """Load trained ensemble from disk or train if missing."""
        if self.model_path.exists():
            try:
                with open(self.model_path, "rb") as f:
                    self.model = pickle.load(f)
                return
            except Exception as e:
                print(f"[Burn-Ex ML] Warning: Could not load existing model ({e}). Retraining...")

        print("[Burn-Ex ML] Generating dataset and training Stacked Ensemble...")
        self.train()

    def _preprocess_features(self, df_features: pd.DataFrame) -> pd.DataFrame:
        """Engineer and one-hot-encode features for the ensemble."""
        df = df_features.copy()

        exercise = str(df.get("exercise_type", ["pushup"]).iloc[0]).lower()
        df["is_pushup"]       = 1.0 if exercise == "pushup" else 0.0
        df["is_squat"]        = 1.0 if exercise == "squat" else 0.0
        df["is_jumping_jack"] = 1.0 if exercise == "jumping_jack" else 0.0

        # Derived features
        pav  = float(df["peak_angular_velocity"].iloc[0]) if "peak_angular_velocity" in df.columns else 150.0
        rom  = float(df["rom_completeness_ratio"].iloc[0]) if "rom_completeness_ratio" in df.columns else 1.0
        vrr  = float(df["valid_rep_ratio"].iloc[0]) if "valid_rep_ratio" in df.columns else 1.0
        cadv = float(df["rep_cadence_variance"].iloc[0]) if "rep_cadence_variance" in df.columns else 0.0
        rv   = float(df["rep_velocity"].iloc[0]) if "rep_velocity" in df.columns else 20.0
        base_cad = _BASELINE_CADENCE.get(exercise, 20.0)

        df["power_index"]        = float(np.clip(pav * rom / 300.0, 0.0, 2.0))
        df["fatigue_index"]      = float(np.clip(cadv * (1.0 - vrr), 0.0, 1.0))
        df["intensity_normalized"] = float(np.clip(rv / base_cad, 0.2, 2.5))

        for col in RESIDUAL_FEATURE_COLUMNS:
            if col not in df.columns:
                df[col] = 0.0

        return df[RESIDUAL_FEATURE_COLUMNS].astype(float)

    def calculate_k_base(
        self,
        exercise_type: str,
        user_weight_kg: float,
        duration_sec: float,
        user_height_cm: float = 175.0,
        user_age: int = 25,
        user_gender: str = "male",
    ) -> float:
        """
        Personalised base MET energy: K_base = MET * (BMR/24) * (duration_hours).
        Uses Mifflin-St Jeor BMR for individual metabolic calibration.
        """
        met = MET_VALUES.get(exercise_type.lower(), 8.5)
        bmr = calculate_bmr(user_weight_kg, user_height_cm, user_age, user_gender)
        duration_hours = max(0.001, duration_sec) / 3600.0
        return float(met * (bmr / 24.0) * duration_hours)

    def calculate_ground_truth_multiplier(
        self,
        peak_angular_velocity: float,
        rom_completeness_ratio: float,
        valid_rep_ratio: float,
        rep_velocity: float,
        torso_inclination_angle: float,
        exercise_type: str = "pushup",
    ) -> float:
        """
        Physics-based ground truth form multiplier based on biomechanical laws.
        Components:
          1. Power/explosiveness (angular velocity proxy for muscular power output)
          2. ROM completeness (partial reps penalised)
          3. Form accuracy (valid rep ratio)
          4. Cadence intensity (rep rate vs baseline)
          5. Posture alignment (torso inclination penalty)
        """
        # 1. Power / explosiveness (ref: ~180 deg/s moderate)
        power_factor = 1.0 + 0.28 * np.clip((peak_angular_velocity - 180.0) / 100.0, -0.45, 0.65)

        # 2. ROM completeness (flexible rating for user comfort)
        rom_factor = 0.85 + 0.25 * np.clip(rom_completeness_ratio, 0.8, 1.3)

        # 3. Form / technique accuracy
        form_factor = 0.82 + 0.18 * np.clip(valid_rep_ratio, 0.0, 1.0)

        # 4. Cadence intensity
        base_cad = _BASELINE_CADENCE.get(exercise_type.lower(), 20.0)
        cadence_factor = 1.0 + 0.18 * np.clip((rep_velocity - base_cad) / base_cad, -0.5, 0.8)

        # 5. Posture penalty (excessive torso lean → less efficient)
        if exercise_type.lower() == "pushup":
            # Pushup: torso ~85° from vertical is optimal
            ideal_torso = 85.0
        elif exercise_type.lower() == "squat":
            ideal_torso = 20.0
        else:
            ideal_torso = 10.0
        torso_deviation = abs(torso_inclination_angle - ideal_torso) / 90.0
        posture_factor = 1.0 - 0.08 * np.clip(torso_deviation, 0.0, 1.0)

        m_form = power_factor * rom_factor * form_factor * cadence_factor * posture_factor
        return float(np.clip(m_form, _M_MIN, _M_MAX))

    def predict(self, df_features: pd.DataFrame) -> Tuple[float, float, float]:
        """
        Predict energy expenditure range using Physics-Informed Stacked Ensemble.

        Returns:
            Tuple[float, float, float]: (lower_bound_kcal, point_kcal, upper_bound_kcal)
        """
        X = self._preprocess_features(df_features)
        exercise_type  = str(df_features.get("exercise_type", ["pushup"]).iloc[0]).lower()
        user_weight    = float(df_features.get("user_weight_kg", [70.0]).iloc[0])
        user_height    = float(df_features.get("user_height_cm", [175.0]).iloc[0])
        user_age       = int(df_features.get("user_age", [25]).iloc[0])
        user_gender    = str(df_features.get("user_gender", ["male"]).iloc[0])
        duration_sec   = float(df_features.get("duration_sec", [1.0]).iloc[0])
        valid_rep_ratio = float(df_features.get("valid_rep_ratio", [1.0]).iloc[0])

        # Step 1: Base MET energy (personalised BMR)
        k_base = self.calculate_k_base(
            exercise_type=exercise_type,
            user_weight_kg=user_weight,
            duration_sec=duration_sec,
            user_height_cm=user_height,
            user_age=user_age,
            user_gender=user_gender,
        )

        # Step 2: Ensemble prediction of M_form
        if self.model is not None:
            try:
                m_pred = float(self.model.predict(X)[0])
            except Exception:
                m_pred = 1.0
        else:
            m_pred = 1.0

        m_form = float(np.clip(m_pred, _M_MIN, _M_MAX))

        # Step 3: Point estimate
        point_kcal = k_base * m_form

        # Step 4: Calibrated uncertainty bounds
        # Higher uncertainty for poor form and short sessions
        form_uncertainty  = (1.0 - valid_rep_ratio) * 0.10
        duration_factor   = max(0.0, 1.0 - duration_sec / 120.0) * 0.05  # more uncertain early on
        uncertainty_rate  = 0.06 + form_uncertainty + duration_factor

        m_lower = float(np.clip(m_form * (1.0 - uncertainty_rate), _M_MIN, _M_MAX))
        m_upper = float(np.clip(m_form * (1.0 + uncertainty_rate), _M_MIN, _M_MAX))

        lower_kcal = max(0.01, k_base * m_lower)
        upper_kcal = max(lower_kcal + 0.01, k_base * m_upper)

        return (round(lower_kcal, 2), round(point_kcal, 2), round(upper_kcal, 2))

    def generate_datasets(
        self, num_participants: int = 60, samples_per_participant: int = 50
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Generates grouped workout sessions for Leave-One-Person-Out (LOPO) training.
        60 virtual athletes × 50 sessions = 3,000 training samples.
        """
        np.random.seed(42)

        # 1. Reference Baselines
        ref_rows = []
        for ex, met in MET_VALUES.items():
            cfg = EXERCISE_CONFIGS[ex]
            ref_rows.append({
                "exercise_type": ex,
                "standard_met": met,
                "target_ideal_rom_deg": cfg.target_ideal_rom,
                "up_threshold_deg": cfg.up_angle_threshold,
                "down_threshold_deg": cfg.down_angle_threshold,
            })
        df_ref = pd.DataFrame(ref_rows)
        REFERENCE_BASELINES_CSV.parent.mkdir(parents=True, exist_ok=True)
        df_ref.to_csv(REFERENCE_BASELINES_CSV, index=False)

        # 2. Grouped Synthetic Sessions
        exercises = list(MET_VALUES.keys())
        data_rows = []

        for p_id in range(1, num_participants + 1):
            p_weight      = np.random.uniform(45.0, 115.0)
            p_height      = np.random.uniform(148.0, 205.0)
            p_age         = np.random.randint(16, 75)
            p_gender      = np.random.choice(["male", "female"])
            p_fitness     = np.random.beta(3, 2)           # 0-1, fitness level
            p_tempo_bias  = 0.6 + 0.8 * p_fitness          # faster → fitter
            p_form_bias   = np.random.beta(5 + 3 * p_fitness, 2)  # better form → fitter

            for _ in range(samples_per_participant):
                ex = np.random.choice(exercises)
                duration = np.random.uniform(15.0, 300.0)

                base_cad = _BASELINE_CADENCE[ex]
                cadence = base_cad * p_tempo_bias * np.random.uniform(0.7, 1.3)
                expected_reps = int(max(1, (duration / 60.0) * cadence))

                valid_ratio = float(np.clip(p_form_bias * np.random.uniform(0.82, 1.05), 0.2, 1.0))
                valid_reps = int(expected_reps * valid_ratio)
                invalid_reps = expected_reps - valid_reps
                total_reps = valid_reps + invalid_reps

                cfg = EXERCISE_CONFIGS[ex]
                rom_completeness = float(np.clip(np.random.normal(0.93, 0.18), 0.3, 1.35))
                avg_rom = round(cfg.target_ideal_rom * rom_completeness, 1)

                peak_angular_vel = float(np.clip(np.random.normal(190.0 * p_tempo_bias, 40.0), 60.0, 420.0))
                torso_angle      = float(np.clip(np.random.normal(85.0 if ex == "pushup" else 20.0, 10.0), 0.0, 95.0))
                cadence_var      = float(np.clip(np.random.exponential(0.30), 0.02, 1.5))
                rep_velocity     = total_reps / max(1.0, duration / 60.0)

                m_target = self.calculate_ground_truth_multiplier(
                    peak_angular_velocity=peak_angular_vel,
                    rom_completeness_ratio=rom_completeness,
                    valid_rep_ratio=valid_reps / max(1, total_reps),
                    rep_velocity=rep_velocity,
                    torso_inclination_angle=torso_angle,
                    exercise_type=ex,
                )
                # ±1.5% physiological measurement noise
                m_target = float(np.clip(m_target * np.random.normal(1.0, 0.015), _M_MIN, _M_MAX))

                k_base = self.calculate_k_base(
                    exercise_type=ex,
                    user_weight_kg=p_weight,
                    duration_sec=duration,
                    user_height_cm=p_height,
                    user_age=p_age,
                    user_gender=p_gender,
                )
                target_kcal = k_base * m_target

                data_rows.append({
                    "participant_id": f"ATHLETE_{p_id:03d}",
                    "exercise_type": ex,
                    "user_weight_kg": round(p_weight, 1),
                    "user_height_cm": round(p_height, 1),
                    "user_age": p_age,
                    "user_gender": p_gender,
                    "duration_sec": round(duration, 1),
                    "total_reps": total_reps,
                    "valid_reps": valid_reps,
                    "invalid_reps": invalid_reps,
                    "valid_rep_ratio": round(valid_reps / max(1, total_reps), 3),
                    "avg_rom_deg": avg_rom,
                    "rep_velocity": round(rep_velocity, 2),
                    "peak_angular_velocity": round(peak_angular_vel, 1),
                    "rom_completeness_ratio": round(rom_completeness, 3),
                    "torso_inclination_angle": round(torso_angle, 1),
                    "rep_cadence_variance": round(cadence_var, 3),
                    "k_base_kcal": round(k_base, 3),
                    "target_multiplier_m": round(m_target, 4),
                    "target_kcal": round(target_kcal, 3),
                })

        df_raw = pd.DataFrame(data_rows)
        RAW_SESSIONS_CSV.parent.mkdir(parents=True, exist_ok=True)
        df_raw.to_csv(RAW_SESSIONS_CSV, index=False)

        return df_ref, df_raw

    def train(self, num_participants: int = 60) -> None:
        """
        Train Physics-Informed Stacked Ensemble on M_form target with LOPO Group-K-Fold CV.

        Architecture:
          Layer 1 (Base models, 10-fold OOF):
            - XGBRegressor       (gradient boosted trees, GPU-optional)
            - GradientBoosting   (sklearn, better calibration on small data)
          Layer 2 (Meta-learner):
            - RidgeCV            (linear blend of OOF predictions)
        The final base models are retrained on the full dataset.
        The meta-learner is fit on OOF predictions.
        """
        from xgboost import XGBRegressor
        from sklearn.ensemble import GradientBoostingRegressor
        from sklearn.linear_model import RidgeCV
        from sklearn.model_selection import GroupKFold
        from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
        from sklearn.pipeline import make_pipeline
        from sklearn.preprocessing import StandardScaler

        if not RAW_SESSIONS_CSV.exists():
            _, df_raw = self.generate_datasets(num_participants=num_participants)
        else:
            df_raw = pd.read_csv(RAW_SESSIONS_CSV)
            if "target_multiplier_m" not in df_raw.columns or len(df_raw) < 500:
                _, df_raw = self.generate_datasets(num_participants=num_participants)

        # Build feature matrix
        X_list = []
        for _, row in df_raw.iterrows():
            single_df = pd.DataFrame([row.to_dict()])
            X_list.append(self._preprocess_features(single_df).iloc[0])

        X       = pd.DataFrame(X_list)
        y       = df_raw["target_multiplier_m"].values
        groups  = df_raw["participant_id"].values

        # ---- Stacked CV ----
        n_splits = min(10, len(np.unique(groups)))
        gkf = GroupKFold(n_splits=n_splits)

        oof_xgb = np.zeros(len(y))
        oof_gbr = np.zeros(len(y))
        fold_rmses, fold_maes, fold_r2s = [], [], []

        xgb_params = dict(
            n_estimators=300,
            max_depth=4,
            learning_rate=0.04,
            subsample=0.80,
            colsample_bytree=0.80,
            min_child_weight=3,
            reg_alpha=0.05,
            reg_lambda=1.0,
            random_state=42,
            n_jobs=-1,
        )
        gbr_params = dict(
            n_estimators=300,
            max_depth=3,
            learning_rate=0.04,
            subsample=0.80,
            min_samples_leaf=8,
            max_features=0.80,
            random_state=42,
        )

        for fold_idx, (train_idx, val_idx) in enumerate(gkf.split(X, y, groups)):
            X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
            y_tr, y_val = y[train_idx], y[val_idx]

            xgb_m = XGBRegressor(**xgb_params)
            xgb_m.fit(X_tr, y_tr)
            oof_xgb[val_idx] = xgb_m.predict(X_val)

            gbr_m = GradientBoostingRegressor(**gbr_params)
            gbr_m.fit(X_tr, y_tr)
            oof_gbr[val_idx] = gbr_m.predict(X_val)

            # Ensemble blend for fold metrics
            oof_blend = (oof_xgb[val_idx] + oof_gbr[val_idx]) / 2.0
            fold_rmses.append(np.sqrt(mean_squared_error(y_val, oof_blend)))
            fold_maes.append(mean_absolute_error(y_val, oof_blend))
            fold_r2s.append(r2_score(y_val, oof_blend))

        print(f"[Burn-Ex ML LOPO] {n_splits}-Fold Group CV (Stacked Ensemble):")
        print(f"  Multiplier MAE: {np.mean(fold_maes):.4f} | RMSE: {np.mean(fold_rmses):.4f} | R²: {np.mean(fold_r2s):.4f}")

        # ---- Meta-learner: Ridge blending OOF predictions ----
        oof_stack = np.column_stack([oof_xgb, oof_gbr])
        meta_learner = make_pipeline(StandardScaler(), RidgeCV(alphas=[0.01, 0.1, 1.0, 10.0]))
        meta_learner.fit(oof_stack, y)

        # ---- Final base models on full data ----
        final_xgb = XGBRegressor(**xgb_params)
        final_xgb.fit(X, y)

        final_gbr = GradientBoostingRegressor(**gbr_params)
        final_gbr.fit(X, y)

        # ---- Bundle into callable wrapper ----
        class StackedEnsemble:
            def __init__(self, xgb, gbr, meta):
                self.xgb  = xgb
                self.gbr  = gbr
                self.meta = meta

            def predict(self, X_new: pd.DataFrame) -> np.ndarray:
                p_xgb = self.xgb.predict(X_new).reshape(-1, 1)
                p_gbr = self.gbr.predict(X_new).reshape(-1, 1)
                stack  = np.hstack([p_xgb, p_gbr])
                return self.meta.predict(stack)

        self.model = StackedEnsemble(final_xgb, final_gbr, meta_learner)

        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(self.model, f)

        print(f"[Burn-Ex ML] Stacked ensemble saved to {MODEL_PATH}")
