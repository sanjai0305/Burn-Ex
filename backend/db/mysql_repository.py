"""
backend/db/mysql_repository.py
MySQL repository — the SOLE application data access layer.
All MongoDB, SQLite, JSON, and Firestore operations have been replaced here.
Uses synchronous SQLAlchemy sessions for compatibility with FastAPI's sync routes
and the existing non-async codebase.
"""

import datetime
import math
from typing import Optional, Dict, Any, List

from sqlalchemy.orm import Session
from sqlalchemy import select, func, update, delete

from db.database import db_session, get_session_factory
from db.models import (
    User, Workout, WorkoutSession, Leaderboard, AIPlan,
    Subscription, AICredits, Payment, Notification, Achievement,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_db() -> Session:
    """Return a new session. Caller is responsible for closing it."""
    return get_session_factory()()


def _user_to_dict(u: User) -> Dict[str, Any]:
    return u.to_dict()


# ==============================================================================
# USER PROFILE
# ==============================================================================

def find_user_by_uid(firebase_uid: str) -> Optional[Dict[str, Any]]:
    with db_session() as db:
        u = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
        return u.to_dict() if u else None


def find_user_by_uid_obj(firebase_uid: str) -> Optional[User]:
    with db_session() as db:
        return db.scalar(select(User).where(User.firebase_uid == firebase_uid))


def find_user_by_mobile(mobile: str, exclude_uid: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with db_session() as db:
        q = select(User).where(User.mobile_number == mobile)
        if exclude_uid:
            q = q.where(User.firebase_uid != exclude_uid)
        u = db.scalar(q)
        return u.to_dict() if u else None


def find_user_by_alt_mobile(mobile: str, exclude_uid: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with db_session() as db:
        q = select(User).where(User.alternate_mobile_number == mobile)
        if exclude_uid:
            q = q.where(User.firebase_uid != exclude_uid)
        u = db.scalar(q)
        return u.to_dict() if u else None


def create_user(data: Dict[str, Any]) -> str:
    """Insert a new user and return the firebase_uid."""
    with db_session() as db:
        u = User(
            firebase_uid=data["firebase_uid"],
            email=data.get("email"),
            name=data.get("name", "Athlete"),
            age=data.get("age"),
            gender=data.get("gender"),
            height_cm=data.get("height_cm"),
            weight_kg=data.get("weight_kg"),
            fitness_goal=data.get("fitness_goal"),
            avatar_url=data.get("avatar_url") or data.get("profile_picture"),
            profile_picture=data.get("profile_picture") or data.get("avatar_url"),
            date_of_birth=data.get("date_of_birth"),
            location=data.get("location"),
            bio=data.get("bio"),
            mobile_number=data.get("mobile_number") or None,
            mobile_verified=bool(data.get("mobile_verified", False)),
            alternate_mobile_number=data.get("alternate_mobile_number") or None,
            alternate_mobile_verified=bool(data.get("alternate_mobile_verified", False)),
            profile_completed=bool(data.get("profile_completed", False)),
            level=data.get("level", 1),
            xp=data.get("xp", 0),
            total_workouts=data.get("total_workouts", 0),
            total_reps=data.get("total_reps", 0),
            total_calories=data.get("total_calories", 0.0),
            current_streak=data.get("current_streak", 0),
            longest_streak=data.get("longest_streak", 0),
            last_active=data.get("last_active"),
            target_weight_kg=data.get("target_weight_kg"),
            goal_timeline_months=data.get("goal_timeline_months"),
            fitness_goals_json=data.get("fitness_goals_json"),
        )
        db.add(u)
        db.flush()
        return u.firebase_uid


def update_user(firebase_uid: str, updates: Dict[str, Any]) -> bool:
    """Partial update on a user record. Returns True if the record was modified."""
    allowed_columns = {
        "email", "name", "age", "gender", "height_cm", "weight_kg",
        "fitness_goal", "avatar_url", "profile_picture", "date_of_birth",
        "location", "bio", "mobile_number", "mobile_verified",
        "alternate_mobile_number", "alternate_mobile_verified",
        "profile_completed", "level", "xp", "total_workouts", "total_reps",
        "total_calories", "current_streak", "longest_streak", "last_active",
        "target_weight_kg", "goal_timeline_months", "fitness_goals_json", "role",
    }
    filtered = {k: v for k, v in updates.items() if k in allowed_columns}
    if not filtered:
        return False
    filtered["updated_at"] = datetime.datetime.now(datetime.timezone.utc)
    with db_session() as db:
        result = db.execute(
            update(User)
            .where(User.firebase_uid == firebase_uid)
            .values(**filtered)
        )
        return result.rowcount > 0


def upsert_user(firebase_uid: str, data: Dict[str, Any]) -> bool:
    """Insert-or-update user. Returns True on success."""
    existing = find_user_by_uid(firebase_uid)
    if existing:
        return update_user(firebase_uid, data)
    else:
        data["firebase_uid"] = firebase_uid
        create_user(data)
        return True


def get_all_users() -> List[Dict[str, Any]]:
    with db_session() as db:
        users = db.scalars(select(User)).all()
        return [u.to_dict() for u in users]


# ==============================================================================
# WORKOUT HISTORY
# ==============================================================================

def save_workout(doc: Dict[str, Any]) -> Any:
    """Save a completed workout session. Idempotent by workout_id. Returns the workout_id."""
    with db_session() as db:
        firebase_uid = doc.get("firebase_uid") or doc.get("user_id") or doc.get("uid", "")
        user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
        user_id = user.id if user else None

        workout_id = doc.get("workout_id") or doc.get("session_id") or f"wk_{int(datetime.datetime.utcnow().timestamp())}"
        existing = db.scalar(select(Workout).where(Workout.workout_id == workout_id))

        workout_date_str = doc.get("workout_date") or datetime.date.today().isoformat()
        try:
            if isinstance(workout_date_str, datetime.date):
                workout_date = workout_date_str
            else:
                workout_date = datetime.date.fromisoformat(str(workout_date_str)[:10])
        except Exception:
            workout_date = datetime.date.today()

        if existing:
            existing.calories_burned = float(doc.get("calories_burned") or doc.get("predicted_kcal", existing.calories_burned))
            existing.total_reps = int(doc.get("reps_completed") or doc.get("total_reps", existing.total_reps))
            existing.valid_reps = int(doc.get("valid_reps", existing.valid_reps))
            existing.form_accuracy_score = float(doc.get("form_score_pct") or doc.get("form_accuracy_score", existing.form_accuracy_score))
            db.flush()
            return existing.workout_id

        w = Workout(
            workout_id=workout_id,
            user_id=user_id,
            firebase_uid=firebase_uid,
            exercise_type=doc.get("workout_type") or doc.get("exercise_type", "pushup"),
            exercise_name=doc.get("exercise_name"),
            workout_type=doc.get("workout_type") or doc.get("exercise_type"),
            workout_date=workout_date,
            duration_seconds=float(doc.get("duration_sec") or doc.get("duration_seconds", 0.0)),
            total_reps=int(doc.get("reps_completed") or doc.get("total_reps", 0)),
            valid_reps=int(doc.get("valid_reps", 0)),
            invalid_reps=int(doc.get("invalid_reps", 0)),
            valid_rep_ratio=float(doc.get("valid_rep_ratio", 0.0)),
            avg_rom_deg=float(doc.get("avg_rom") or doc.get("avg_rom_deg", 0.0)),
            form_accuracy_score=float(doc.get("form_score_pct") or doc.get("form_accuracy_score", 0.0)),
            calories_burned=float(doc.get("calories_burned") or doc.get("predicted_kcal", 0.0)),
            predicted_kcal=float(doc.get("predicted_kcal") or doc.get("calories_burned", 0.0)),
            status="completed",
        )
        db.add(w)
        db.flush()
        return w.workout_id


def save_workout_session(firebase_uid: str, session_data: Dict[str, Any]) -> int:
    """Save a local coach session record. Returns new record ID."""
    with db_session() as db:
        user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
        user_id = user.id if user else None

        ws = WorkoutSession(
            firebase_uid=firebase_uid,
            user_id=user_id,
            session_id=session_data.get("session_id"),
            timestamp=session_data.get("timestamp"),
            exercise_type=session_data.get("exercise_type", "pushup"),
            exercise_name=session_data.get("exercise_name", "Push-up"),
            duration_sec=float(session_data.get("duration_sec", 0.0)),
            total_reps=int(session_data.get("total_reps", 0)),
            valid_reps=int(session_data.get("valid_reps", 0)),
            invalid_reps=int(session_data.get("invalid_reps", 0)),
            valid_rep_ratio=float(session_data.get("valid_rep_ratio", 0.0)),
            avg_rom_deg=float(session_data.get("avg_rom_deg", 0.0)),
            rep_velocity=float(session_data.get("rep_velocity", 0.0)),
            form_score_pct=float(session_data.get("form_score_pct", 100.0)),
            kcal_lower=float(session_data.get("kcal_lower", 0.0)),
            kcal_point=float(session_data.get("kcal_point") or session_data.get("predicted_kcal", 0.0)),
            kcal_upper=float(session_data.get("kcal_upper", 0.0)),
            rep_rom_data=session_data.get("rep_rom_data"),
            xp_gained=int(session_data.get("xp_gained", 0)),
        )
        db.add(ws)
        db.flush()
        return ws.id


def get_workout_history(
    firebase_uid: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    """Query workout history for a user with optional date range and text filtering."""
    with db_session() as db:
        q = select(Workout).where(Workout.firebase_uid == firebase_uid)
        if start_date:
            q = q.where(Workout.workout_date >= datetime.date.fromisoformat(start_date))
        if end_date:
            q = q.where(Workout.workout_date <= datetime.date.fromisoformat(end_date))
        if search:
            pattern = f"%{search}%"
            q = q.where(
                (Workout.exercise_type.like(pattern)) |
                (Workout.exercise_name.like(pattern)) |
                (Workout.workout_type.like(pattern))
            )
        total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
        workouts = db.scalars(q.order_by(Workout.workout_date.desc()).offset(skip).limit(limit)).all()
        return {"items": [w.to_dict() for w in workouts], "total": total}


def get_all_sessions_for_user(firebase_uid: str) -> List[Dict[str, Any]]:
    """Get all workout sessions for a user (for leaderboard/stats)."""
    with db_session() as db:
        sessions = db.scalars(
            select(WorkoutSession)
            .where(WorkoutSession.firebase_uid == firebase_uid)
            .order_by(WorkoutSession.created_at.desc())
        ).all()
        return [s.to_dict() for s in sessions]


def get_all_sessions() -> List[Dict[str, Any]]:
    """Get all sessions across all users (for leaderboard computation)."""
    with db_session() as db:
        sessions = db.scalars(
            select(WorkoutSession).order_by(WorkoutSession.created_at.desc()).limit(5000)
        ).all()
        return [s.to_dict() for s in sessions]


def get_calories_analytics(
    firebase_uid: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Calculate calorie analytics for a user over a date range."""
    with db_session() as db:
        q = select(Workout).where(Workout.firebase_uid == firebase_uid)
        if start_date:
            q = q.where(Workout.workout_date >= datetime.date.fromisoformat(start_date))
        if end_date:
            q = q.where(Workout.workout_date <= datetime.date.fromisoformat(end_date))
        workouts = db.scalars(q.order_by(Workout.workout_date.asc())).all()

        daily_map: Dict[str, Dict[str, Any]] = {}
        total_kcal = 0.0
        total_reps_count = 0

        for w in workouts:
            w_date = w.workout_date.isoformat() if w.workout_date else ""
            if not w_date:
                continue
            kcal = float(w.calories_burned or w.predicted_kcal or 0.0)
            reps = int(w.total_reps or 0)
            total_kcal += kcal
            total_reps_count += reps
            if w_date not in daily_map:
                daily_map[w_date] = {"date": w_date, "calories": 0.0, "workouts": 0, "reps": 0}
            daily_map[w_date]["calories"] += kcal
            daily_map[w_date]["workouts"] += 1
            daily_map[w_date]["reps"] += reps

        daily_breakdown = list(daily_map.values())
        for d in daily_breakdown:
            d["calories"] = round(d["calories"], 1)

        days_count = len(daily_breakdown) if daily_breakdown else 1
        avg_daily = round(total_kcal / days_count, 1)

        return {
            "totalCalories": round(total_kcal, 1),
            "workouts": len(workouts),
            "totalReps": total_reps_count,
            "avgDaily": avg_daily,
            "dailyBreakdown": daily_breakdown,
        }


# ==============================================================================
# LEADERBOARD
# ==============================================================================

def update_leaderboard(firebase_uid: str, athlete_alias: str, kcal_burned: float, form_score: float, valid_reps: int):
    """Update leaderboard entry for a user (upsert)."""
    with db_session() as db:
        user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
        user_id = user.id if user else None

        lb = db.scalar(select(Leaderboard).where(Leaderboard.firebase_uid == firebase_uid))
        if lb:
            old_reps = lb.total_valid_reps or 0
            new_reps = old_reps + valid_reps
            if new_reps > 0:
                new_form = ((lb.global_form_score_avg * old_reps) + (form_score * valid_reps)) / new_reps
            else:
                new_form = form_score
            lb.total_kcal_burned = (lb.total_kcal_burned or 0.0) + kcal_burned
            lb.global_form_score_avg = new_form
            lb.total_valid_reps = new_reps
            lb.total_workouts = (lb.total_workouts or 0) + 1
            lb.last_workout_timestamp = datetime.datetime.now(datetime.timezone.utc)
            lb.athlete_alias = athlete_alias
        else:
            lb = Leaderboard(
                firebase_uid=firebase_uid,
                user_id=user_id,
                athlete_alias=athlete_alias,
                total_kcal_burned=kcal_burned,
                global_form_score_avg=form_score,
                total_valid_reps=valid_reps,
                total_workouts=1,
                last_workout_timestamp=datetime.datetime.now(datetime.timezone.utc),
            )
            db.add(lb)


def get_leaderboard_data() -> List[Dict[str, Any]]:
    """Retrieve top 10 leaderboard entries ranked by kcal burned."""
    with db_session() as db:
        entries = db.scalars(
            select(Leaderboard)
            .order_by(Leaderboard.total_kcal_burned.desc(), Leaderboard.global_form_score_avg.desc())
            .limit(10)
        ).all()
        return [e.to_dict() for e in entries]


# ==============================================================================
# AI PLANS
# ==============================================================================

def get_ai_plan(firebase_uid: str) -> Optional[Dict[str, Any]]:
    with db_session() as db:
        p = db.scalar(select(AIPlan).where(AIPlan.firebase_uid == firebase_uid))
        return p.plan_data if p else None


def set_ai_plan(firebase_uid: str, plan_data: Dict[str, Any]):
    """Upsert AI plan data."""
    with db_session() as db:
        user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
        user_id = user.id if user else None
        p = db.scalar(select(AIPlan).where(AIPlan.firebase_uid == firebase_uid))
        if p:
            p.plan_data = plan_data
            p.updated_at = datetime.datetime.now(datetime.timezone.utc)
        else:
            p = AIPlan(firebase_uid=firebase_uid, user_id=user_id, plan_data=plan_data)
            db.add(p)


# ==============================================================================
# SUBSCRIPTION & AI CREDITS
# ==============================================================================

def get_user_subscription(firebase_uid: str) -> Dict[str, Any]:
    """
    Fetch subscription status, trial progress, and today's AI Coach credits.
    Enforces daily credit reset at 00:00 UTC.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    today_str = now.strftime("%Y-%m-%d")

    with db_session() as db:
        sub = db.scalar(select(Subscription).where(Subscription.firebase_uid == firebase_uid))
        credits = db.scalar(select(AICredits).where(AICredits.firebase_uid == firebase_uid))

        plan = sub.plan if sub else "free"
        status = sub.status if sub else "inactive"
        trial_eligible = sub.trial_eligible if sub else True
        trial_started_at = sub.trial_started_at.isoformat() if (sub and sub.trial_started_at) else None
        trial_ends_at = sub.trial_ends_at.isoformat() if (sub and sub.trial_ends_at) else None

        # Calculate remaining trial days
        remaining_days = 0
        if sub and sub.trial_ends_at:
            ends_dt = sub.trial_ends_at
            if ends_dt.tzinfo is None:
                ends_dt = ends_dt.replace(tzinfo=datetime.timezone.utc)
            diff = ends_dt - now
            if diff.total_seconds() > 0:
                remaining_days = max(1, math.ceil(diff.total_seconds() / 86400))
            else:
                remaining_days = 0
                if plan == "trial":
                    status = "expired"

        # Daily AI Credits with reset logic
        if credits is None:
            # Create fresh credits record
            user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
            credits = AICredits(
                firebase_uid=firebase_uid,
                user_id=user.id if user else None,
                last_reset_date=today_str,
                used_today=0,
            )
            db.add(credits)
            db.flush()
            credits_used = 0
        elif credits.last_reset_date != today_str:
            credits.last_reset_date = today_str
            credits.used_today = 0
            credits_used = 0
        else:
            credits_used = credits.used_today or 0

        is_pro = (plan == "pro" and status == "active")
        credits_limit = 9999 if is_pro else 5
        credits_remaining = 9999 if is_pro else max(0, credits_limit - credits_used)

        tomorrow_utc = (now + datetime.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        secs_until_reset = int((tomorrow_utc - now).total_seconds())
        hours_left = secs_until_reset // 3600
        mins_left = (secs_until_reset % 3600) // 60

        return {
            "plan": plan,
            "status": status,
            "trial_eligible": trial_eligible,
            "trial_started_at": trial_started_at,
            "trial_ends_at": trial_ends_at,
            "remaining_days": remaining_days,
            "ai_credits_limit": 5,
            "ai_credits_used": credits_used,
            "ai_credits_remaining": credits_remaining,
            "price_inr": 499,
            "is_pro": is_pro,
            "resets_in": f"{hours_left}h {mins_left}m",
        }


def start_user_trial(firebase_uid: str) -> Dict[str, Any]:
    """Activate 30-day Free Trial. Idempotent."""
    now = datetime.datetime.now(datetime.timezone.utc)
    ends_at = now + datetime.timedelta(days=30)

    with db_session() as db:
        user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
        user_id = user.id if user else None

        sub = db.scalar(select(Subscription).where(Subscription.firebase_uid == firebase_uid))
        if sub and sub.trial_started_at:
            # Already claimed — return current status
            return get_user_subscription(firebase_uid)

        if sub:
            sub.plan = "trial"
            sub.status = "active"
            sub.trial_eligible = False
            sub.trial_started_at = now
            sub.trial_ends_at = ends_at
            sub.updated_at = now
        else:
            sub = Subscription(
                firebase_uid=firebase_uid,
                user_id=user_id,
                plan="trial",
                status="active",
                trial_eligible=False,
                trial_started_at=now,
                trial_ends_at=ends_at,
            )
            db.add(sub)

    return get_user_subscription(firebase_uid)


def activate_user_pro(firebase_uid: str, payment_details: Dict[str, Any]) -> Dict[str, Any]:
    """Activate paid Pro subscription after Razorpay verification."""
    now = datetime.datetime.now(datetime.timezone.utc)
    period_end = now + datetime.timedelta(days=30)

    with db_session() as db:
        user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
        user_id = user.id if user else None

        sub = db.scalar(select(Subscription).where(Subscription.firebase_uid == firebase_uid))
        if sub:
            sub.plan = "pro"
            sub.status = "active"
            sub.order_id = payment_details.get("order_id")
            sub.payment_id = payment_details.get("payment_id")
            sub.paid_at = now
            sub.current_period_end = period_end
            sub.updated_at = now
        else:
            sub = Subscription(
                firebase_uid=firebase_uid,
                user_id=user_id,
                plan="pro",
                status="active",
                trial_eligible=False,
                order_id=payment_details.get("order_id"),
                payment_id=payment_details.get("payment_id"),
                paid_at=now,
                current_period_end=period_end,
            )
            db.add(sub)

        # Payment audit record
        try:
            existing_payment = db.scalar(
                select(Payment).where(Payment.payment_id == payment_details.get("payment_id"))
            )
            if not existing_payment and payment_details.get("payment_id"):
                payment = Payment(
                    firebase_uid=firebase_uid,
                    user_id=user_id,
                    order_id=payment_details.get("order_id"),
                    payment_id=payment_details.get("payment_id"),
                    amount=int(payment_details.get("amount", 49900)),
                    currency=payment_details.get("currency", "INR"),
                    method=payment_details.get("method", "razorpay"),
                    status="captured",
                )
                db.add(payment)
        except Exception as e:
            print("[MySQL] Payment audit record error:", e)

def check_ai_credit(firebase_uid: str) -> tuple:
    """
    Check if user has remaining AI Coach credits without consuming one.
    Returns (allowed: bool, remaining: int, message: str).
    """
    sub_info = get_user_subscription(firebase_uid)
    if sub_info.get("is_pro"):
        return True, 9999, "Unlimited Pro access"

    now = datetime.datetime.now(datetime.timezone.utc)
    today_str = now.strftime("%Y-%m-%d")

    with db_session() as db:
        credits = db.scalar(select(AICredits).where(AICredits.firebase_uid == firebase_uid))
        if not credits or credits.last_reset_date != today_str:
            return True, 5, "5 credits available"

        credits_used = credits.used_today or 0
        if credits_used >= 5:
            return (
                False, 0,
                "Daily limit of 5 AI Coach credits reached. "
                "Limit resets at 00:00 UTC or upgrade to Burn-Ex Pro for unlimited credits."
            )

        remaining = max(0, 5 - credits_used)
        return True, remaining, f"{remaining} credits remaining"


def consume_ai_credit(firebase_uid: str) -> tuple:
    """
    Consume 1 AI Coach credit atomically.
    Returns (success: bool, remaining: int, message: str).
    """
    sub_info = get_user_subscription(firebase_uid)
    if sub_info.get("is_pro"):
        return True, 9999, "Unlimited Pro access"

    now = datetime.datetime.now(datetime.timezone.utc)
    today_str = now.strftime("%Y-%m-%d")

    with db_session() as db:
        credits = db.scalar(select(AICredits).where(AICredits.firebase_uid == firebase_uid))
        if not credits:
            user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
            credits = AICredits(
                firebase_uid=firebase_uid,
                user_id=user.id if user else None,
                last_reset_date=today_str,
                used_today=0,
            )
            db.add(credits)
            db.flush()

        if credits.last_reset_date != today_str:
            credits.last_reset_date = today_str
            credits.used_today = 0

        credits_used = credits.used_today or 0
        if credits_used >= 5:
            return (
                False, 0,
                "Daily limit of 5 AI Coach credits reached. "
                "Limit resets at 00:00 UTC or upgrade to Burn-Ex Pro for unlimited credits."
            )

        credits.used_today = credits_used + 1
        new_remaining = max(0, 5 - (credits_used + 1))
        return True, new_remaining, "Credit consumed successfully"


# ==============================================================================
# NOTIFICATIONS
# ==============================================================================

def get_notifications(firebase_uid: str) -> List[Dict[str, Any]]:
    with db_session() as db:
        notifs = db.scalars(
            select(Notification)
            .where(Notification.firebase_uid == firebase_uid)
            .order_by(Notification.created_at.desc())
        ).all()
        return [n.to_dict() for n in notifs]


def ensure_initial_notifications(firebase_uid: str, user_name: str):
    """Create default welcome notifications if the user has none yet."""
    with db_session() as db:
        count = db.scalar(
            select(func.count()).where(Notification.firebase_uid == firebase_uid)
        ) or 0
        if count > 0:
            return

        user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
        user_id = user.id if user else None
        now = datetime.datetime.now(datetime.timezone.utc)
        initials = [
            Notification(
                firebase_uid=firebase_uid, user_id=user_id,
                notif_id="notif_welcome",
                title="Welcome to Burn-Ex! 🔥",
                message=f"Welcome aboard, {user_name}! Your AI Biomechanics and Edge Coach are ready for action.",
                category="system", is_read=False, target_view="workouts",
                created_at=now - datetime.timedelta(minutes=15),
            ),
            Notification(
                firebase_uid=firebase_uid, user_id=user_id,
                notif_id="notif_streak",
                title="Daily Workout Reminder ⚡",
                message="Keep your momentum alive! Complete your recommended circuit today to level up your streak.",
                category="workout", is_read=False, target_view="workouts",
                created_at=now - datetime.timedelta(hours=2),
            ),
            Notification(
                firebase_uid=firebase_uid, user_id=user_id,
                notif_id="notif_ai_coach",
                title="AI Coach Calibration Ready 🤖",
                message="Pose landmarker neural weights loaded. 60 FPS live form assessment active.",
                category="ai", is_read=False, target_view="ai_coach",
                created_at=now - datetime.timedelta(hours=6),
            ),
            Notification(
                firebase_uid=firebase_uid, user_id=user_id,
                notif_id="notif_nutrition",
                title="Nutrition Macros Optimized 🥗",
                message="Your macro nutrient distribution has been configured for your target fitness program.",
                category="nutrition", is_read=True, target_view="nutrition",
                created_at=now - datetime.timedelta(days=1),
            ),
        ]
        db.add_all(initials)


def mark_notification_read(firebase_uid: str, notif_id: str) -> bool:
    with db_session() as db:
        notif = db.scalar(
            select(Notification)
            .where(Notification.firebase_uid == firebase_uid, Notification.notif_id == notif_id)
        )
        if notif:
            notif.is_read = True
            return True
        return False


def mark_all_notifications_read(firebase_uid: str):
    with db_session() as db:
        db.execute(
            update(Notification)
            .where(Notification.firebase_uid == firebase_uid)
            .values(is_read=True)
        )


def delete_notification_by_id(firebase_uid: str, notif_id: str):
    with db_session() as db:
        db.execute(
            delete(Notification)
            .where(Notification.firebase_uid == firebase_uid, Notification.notif_id == notif_id)
        )


def add_notification(firebase_uid: str, notif_data: Dict[str, Any]):
    with db_session() as db:
        user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
        n = Notification(
            firebase_uid=firebase_uid,
            user_id=user.id if user else None,
            notif_id=notif_data.get("id", f"notif_{int(datetime.datetime.utcnow().timestamp())}"),
            title=notif_data.get("title", ""),
            message=notif_data.get("message", ""),
            category=notif_data.get("category", "system"),
            is_read=bool(notif_data.get("read", False)),
            target_view=notif_data.get("target_view"),
        )
        db.add(n)


# ==============================================================================
# ACHIEVEMENTS
# ==============================================================================

def get_user_achievement_ids(firebase_uid: str) -> List[str]:
    with db_session() as db:
        rows = db.scalars(
            select(Achievement.achievement_id).where(Achievement.firebase_uid == firebase_uid)
        ).all()
        return list(rows)


def unlock_achievement(firebase_uid: str, achievement_id: str):
    """Unlock an achievement for a user. Idempotent."""
    with db_session() as db:
        existing = db.scalar(
            select(Achievement)
            .where(Achievement.firebase_uid == firebase_uid, Achievement.achievement_id == achievement_id)
        )
        if existing:
            return
        user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
        ach = Achievement(
            firebase_uid=firebase_uid,
            user_id=user.id if user else None,
            achievement_id=achievement_id,
        )
        db.add(ach)
