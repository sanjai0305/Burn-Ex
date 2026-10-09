"""
backend/db/models.py
SQLAlchemy 2.x Declarative Relational Models for Burn-Ex MySQL 8.0+.
"""

import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import (
    BigInteger,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Date,
    JSON,
    Text,
    ForeignKey,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base


def utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


# Compatible PK type for MySQL (BIGINT AUTO_INCREMENT) and SQLite test fixtures (INTEGER AUTOINCREMENT)
PK_BIGINT = BigInteger().with_variant(Integer, "sqlite")


class User(Base):
    """
    User athlete profile and account record.
    Authoritative source for user identity, biometrics, and verification status.
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(PK_BIGINT, primary_key=True, autoincrement=True)
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), index=True, nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, default="Athlete")
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=25)
    gender: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, default="male")
    height_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=175.0)
    weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=70.0)
    fitness_goal: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, default="fat_loss")
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    mobile_number: Mapped[Optional[str]] = mapped_column(String(32), unique=True, index=True, nullable=True)
    alternate_mobile_number: Mapped[Optional[str]] = mapped_column(String(32), index=True, nullable=True)
    role: Mapped[str] = mapped_column(String(32), default="user", nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    profile_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    workouts: Mapped[List["Workout"]] = relationship("Workout", back_populates="user", cascade="all, delete-orphan")
    leaderboard_entry: Mapped[Optional["Leaderboard"]] = relationship("Leaderboard", back_populates="user", uselist=False, cascade="all, delete-orphan")
    ai_plan: Mapped[Optional["AIPlan"]] = relationship("AIPlan", back_populates="user", uselist=False, cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "firebase_uid": self.firebase_uid,
            "uid": self.firebase_uid,
            "email": self.email,
            "name": self.name,
            "age": self.age,
            "gender": self.gender,
            "height_cm": self.height_cm,
            "weight_kg": self.weight_kg,
            "fitness_goal": self.fitness_goal,
            "avatar_url": self.avatar_url,
            "mobile_number": self.mobile_number,
            "alternate_mobile_number": self.alternate_mobile_number,
            "role": self.role,
            "is_verified": self.is_verified,
            "profile_completed": self.profile_completed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Workout(Base):
    """
    Completed workout session records with biometric, kinematic, and calorie telemetry.
    """
    __tablename__ = "workouts"

    id: Mapped[int] = mapped_column(PK_BIGINT, primary_key=True, autoincrement=True)
    workout_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    user_id: Mapped[Optional[int]] = mapped_column(PK_BIGINT, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    firebase_uid: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    exercise_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    exercise_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    workout_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    workout_date: Mapped[datetime.date] = mapped_column(Date, index=True, nullable=False)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_reps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    valid_reps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    invalid_reps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    valid_rep_ratio: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    avg_rom_deg: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    rep_velocity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    form_accuracy_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    calories_burned: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    calorie_burn_rate_bpm: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    predicted_kcal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    target_reps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    target_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    kinematics_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    prediction_bounds: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    summary_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="completed", nullable=False)
    completed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="workouts")

    __table_args__ = (
        Index("ix_workouts_uid_date", "firebase_uid", "workout_date"),
        Index("ix_workouts_exercise_date", "exercise_type", "workout_date"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "workout_id": self.workout_id,
            "firebase_uid": self.firebase_uid,
            "user_id": self.firebase_uid,
            "uid": self.firebase_uid,
            "exercise_type": self.exercise_type,
            "exercise_name": self.exercise_name or self.exercise_type,
            "workout_type": self.workout_type or self.exercise_type,
            "workout_date": self.workout_date.isoformat() if self.workout_date else None,
            "duration_seconds": self.duration_seconds,
            "duration_sec": self.duration_seconds,
            "total_reps": self.total_reps,
            "valid_reps": self.valid_reps,
            "invalid_reps": self.invalid_reps,
            "valid_rep_ratio": self.valid_rep_ratio,
            "avg_rom_deg": self.avg_rom_deg,
            "rep_velocity": self.rep_velocity,
            "form_accuracy_score": self.form_accuracy_score,
            "form_score_pct": self.form_accuracy_score,
            "calories_burned": self.calories_burned,
            "predicted_kcal": self.predicted_kcal or self.calories_burned,
            "calorie_burn_rate_bpm": self.calorie_burn_rate_bpm,
            "target_reps": self.target_reps,
            "target_duration": self.target_duration,
            "kinematics_data": self.kinematics_data,
            "prediction_bounds": self.prediction_bounds,
            "summary_metadata": self.summary_metadata,
            "status": self.status,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "timestamp": self.completed_at.isoformat() if self.completed_at else (self.created_at.isoformat() if self.created_at else None),
        }


class Leaderboard(Base):
    """
    Aggregated athlete performance rankings and leaderboard metrics.
    """
    __tablename__ = "leaderboard"

    id: Mapped[int] = mapped_column(PK_BIGINT, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(PK_BIGINT, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    athlete_alias: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    total_kcal_burned: Mapped[float] = mapped_column(Float, default=0.0, index=True, nullable=False)
    global_form_score_avg: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_valid_reps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_workouts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_workout_timestamp: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="leaderboard_entry")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "athlete_alias": self.athlete_alias,
            "firebase_uid": self.firebase_uid,
            "total_kcal_burned": round(self.total_kcal_burned, 1),
            "global_form_score_avg": round(self.global_form_score_avg, 1),
            "total_valid_reps": self.total_valid_reps,
            "total_workouts": self.total_workouts,
            "last_workout_timestamp": self.last_workout_timestamp.isoformat() if self.last_workout_timestamp else None,
        }


class AIPlan(Base):
    """
    Personalized AI Workout & Nutrition Plans.
    """
    __tablename__ = "ai_plans"

    id: Mapped[int] = mapped_column(PK_BIGINT, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(PK_BIGINT, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    plan_data: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="ai_plan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "firebase_uid": self.firebase_uid,
            "plan_data": self.plan_data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class OTPVerification(Base):
    """
    Secure OTP record storage for phone number authentication and verification.
    """
    __tablename__ = "otp_verifications"

    id: Mapped[int] = mapped_column(PK_BIGINT, primary_key=True, autoincrement=True)
    phone: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    otp_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    purpose: Mapped[str] = mapped_column(String(32), default="login", nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_otp_phone_purpose", "phone", "purpose"),
    )

