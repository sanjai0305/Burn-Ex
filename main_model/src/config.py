"""
Configuration and constants for Burn-Ex.
Includes physics parameters, hysteresis thresholds, EMA smoothing rates, and MET baselines.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Any, Tuple


# Base Project Paths
BASE_DIR: Path = Path(__file__).resolve().parent.parent
DATA_DIR: Path = BASE_DIR / "data"
MODELS_DIR: Path = BASE_DIR / "models"
MODEL_PATH: Path = MODELS_DIR / "burn_ex_xgboost.pkl"
RAW_SESSIONS_CSV: Path = DATA_DIR / "raw_sessions.csv"
REFERENCE_BASELINES_CSV: Path = DATA_DIR / "reference_baselines.csv"
USER_PROFILE_PATH: Path = DATA_DIR / "user_profile.json"
WORKOUT_DB_PATH: Path = DATA_DIR / "workout_history.db"

# Make sure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Vision and Tracking Settings
CAMERA_INDEX: int = 1
TARGET_FPS: int = 30
FRAME_WIDTH: int = 1280
FRAME_HEIGHT: int = 720
MIN_DETECTION_CONFIDENCE: float = 0.5
MIN_TRACKING_CONFIDENCE: float = 0.5
MODEL_COMPLEXITY: int = 0

# Coordinate Smoothing & Debouncing
EMA_SMOOTHING_ALPHA: float = 0.30        # Slightly heavier smoothing for accuracy
ANGULAR_VELOCITY_EMA_ALPHA: float = 0.4  # EMA alpha for angular velocity smoothing
MIN_STATE_HOLD_TIME_SEC: float = 0.25    # 250 ms debounce — tighter for faster reps

# Default User Metrics
DEFAULT_USER_WEIGHT_KG: float = 70.0

# MET (Metabolic Equivalent of Task) — ACSM/Compendium of Physical Activities 2011
# push-ups vigorous: 8.5 MET; bodyweight squat: 5.0 MET; jumping jacks: 9.0 MET
MET_VALUES: Dict[str, float] = {
    "pushup": 8.5,
    "squat": 5.0,
    "jumping_jack": 9.0,
}

# MET per intensity tier — used for live burn-rate estimation
MET_TIERS: Dict[str, Dict[str, float]] = {
    "pushup":       {"low": 5.5,  "moderate": 8.5,  "high": 10.5},
    "squat":        {"low": 3.5,  "moderate": 5.0,  "high": 7.0},
    "jumping_jack": {"low": 6.0,  "moderate": 9.0,  "high": 11.0},
}

# Exercise Biomechanical Thresholds & Configurations
@dataclass
class ExerciseThresholds:
    name: str
    primary_joint: str
    up_angle_threshold: float
    down_angle_threshold: float
    min_rom: float
    target_ideal_rom: float
    form_rules: Dict[str, Any] = field(default_factory=dict)


EXERCISE_CONFIGS: Dict[str, ExerciseThresholds] = {
    "pushup": ExerciseThresholds(
        name="Push-up",
        primary_joint="elbow",
        up_angle_threshold=125.0,      # Arm counts as UP even with bent elbow
        down_angle_threshold=115.0,    # Generous down — captures even shallow half-reps
        min_rom=10.0,                  # Flexible 15° ROM minimum
        target_ideal_rom=45.0,         # Realistic flexible full ROM
        form_rules={
            "spine_min_angle": 90.0,  # Extremely relaxed plank posture
            "spine_max_angle": 320.0,
            #"error_msg": "SAGGING HIPS",
        },
    ),
    "squat": ExerciseThresholds(
        name="Squat",
        primary_joint="knee",
        up_angle_threshold=135.0,      # Standing counts at 135° (very bent knees accepted)
        down_angle_threshold=120.0,    # Accept shallow squats easily
        min_rom=15.0,                  # Flexible 15° minimum ROM for a valid squat
        target_ideal_rom=55.0,
        form_rules={
            "torso_min_angle": 40.0,   # Highly relaxed natural forward lean
            "error_msg": "CHEST TOO LOW",
        },
    ),
    "jumping_jack": ExerciseThresholds(
        name="Jumping Jack",
        primary_joint="shoulder",
        up_angle_threshold=100.0,      # Arms count as overhead much lower
        down_angle_threshold=80.0,     # Arms at side raised to 80° for comfort
        min_rom=20.0,                  # Flexible 20° ROM minimum
        target_ideal_rom=70.0,
        form_rules={
            "arm_sync_threshold": 55.0,  # 55° tolerance — very asymmetric OK
            "error_msg": "ASYMMETRIC ARM EXTENSION",
        },
    ),
}

# Physics-Informed Multiplier Bounds
FORM_MULTIPLIER_MIN: float = 0.60
FORM_MULTIPLIER_MAX: float = 1.40

# UI Styling and Palette (Dark Cyber-Aesthetic)
COLOR_BACKGROUND_DARK: Tuple[int, int, int] = (18, 18, 22)
COLOR_PANEL_BG: Tuple[int, int, int] = (28, 28, 36)
COLOR_ACCENT_CYAN: Tuple[int, int, int] = (255, 208, 0)
COLOR_SUCCESS_GREEN: Tuple[int, int, int] = (74, 222, 128)
COLOR_WARNING_YELLOW: Tuple[int, int, int] = (42, 193, 255)
COLOR_ERROR_RED: Tuple[int, int, int] = (68, 68, 239)
COLOR_TEXT_WHITE: Tuple[int, int, int] = (245, 245, 245)
COLOR_TEXT_MUTED: Tuple[int, int, int] = (160, 160, 175)
COLOR_JOINT_DEFAULT: Tuple[int, int, int] = (230, 180, 50)
COLOR_BONE_DEFAULT: Tuple[int, int, int] = (100, 200, 240)
