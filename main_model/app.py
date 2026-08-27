"""
Burn-Ex Web Studio & Analytics Dashboard Backend.
Flask server providing REST APIs, telemetry streaming, and video MJPEG feeds.
"""

import io
import csv
import json
import time
import threading
from typing import Generator, Dict, Any, Optional
import cv2
import numpy as np
from flask import (
    Flask,
    render_template,
    Response,
    jsonify,
    request,
    send_file,
)

from src.config import (
    CAMERA_INDEX,
    FRAME_WIDTH,
    FRAME_HEIGHT,
    EXERCISE_CONFIGS,
)
from src.vision_pipeline import VisionPipeline
from src.biomechanics import BiomechanicsEngine
from src.feature_extractor import FeatureExtractor
from src.ml_engine import MLEngine
from src.user_manager import UserManager
from src.ui_renderer import UIRenderer
from src.video_stream import VideoStream


app = Flask(__name__, template_folder="templates", static_folder="static")

# Shared Global State & Locks
lock = threading.Lock()
user_manager = UserManager()
initial_profile = user_manager.get_profile()

current_exercise = "pushup"
current_camera_index = CAMERA_INDEX
vision = VisionPipeline()
biomechanics = BiomechanicsEngine(exercise_type=current_exercise)
features = FeatureExtractor(
    user_weight_kg=initial_profile.get("weight_kg", 70.0),
    user_height_cm=initial_profile.get("height_cm", 175.0),
    user_age=initial_profile.get("age", 25),
    user_gender=initial_profile.get("gender", "male"),
)
ml_engine = MLEngine()
renderer = UIRenderer()

# Camera Thread Manager
camera_capture: Optional[VideoStream] = None
camera_running = True
current_fps = 30.0
last_frame_bytes: Optional[bytes] = None


def get_camera() -> VideoStream:
    """Initialize camera if not already open."""
    global camera_capture
    if camera_capture is None or not camera_capture.isOpened():
        camera_capture = VideoStream(current_camera_index, width=FRAME_WIDTH, height=FRAME_HEIGHT).start()
    return camera_capture


def generate_video_stream() -> Generator[bytes, None, None]:
    """
    Generator streaming MJPEG frames with zero raw-video storage.
    """
    global current_fps, last_frame_bytes
    cap = get_camera()
    prev_time = time.time()

    # Fallback dummy frame if webcam is unavailable
    blank_canvas = np.zeros((FRAME_HEIGHT, FRAME_WIDTH, 3), dtype=np.uint8)

    while camera_running:
        success = False
        frame = None
        if cap and cap.isOpened():
            success, frame = cap.read()

        if not success or frame is None:
            frame = blank_canvas.copy()
            # Draw waiting message
            cv2.putText(
                frame,
                "CAMERA FEED OFFLINE - CHECK WEBCAM / PERMISSIONS",
                (int(FRAME_WIDTH * 0.18), int(FRAME_HEIGHT * 0.5)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.75,
                (0, 242, 254),
                2,
                cv2.LINE_AA,
            )
        else:
            frame = cv2.resize(frame, (640, 480))

        now = time.time()
        dt = now - prev_time
        prev_time = now
        current_fps = round(1.0 / dt, 1) if dt > 0 else 30.0

        with lock:
            # 1. Vision Layer (Immediate frame landmark extraction with EMA smoothing)
            landmarks_2d, landmarks_3d, _ = vision.process_frame(frame)

            # 2. Biomechanics State Update
            state = biomechanics.update(landmarks_2d, landmarks_3d)

            # 3. Update active timer
            target_lost = state.get("target_lost", False)
            duration_sec = features.update_timer(target_lost=target_lost)

            # 4. Render Neon Overlay
            primary_joint = EXERCISE_CONFIGS[current_exercise].primary_joint
            renderer.draw_skeleton(
                frame,
                landmarks_2d,
                is_form_valid=state.get("is_form_valid", True),
                active_joint_name=primary_joint,
            )

            # Draw sleek Minimal Studio Overlay on stream
            h, w, _ = frame.shape
            # Privacy badge top-left
            cv2.putText(
                frame,
                "[LOCK] LOCAL ZERO-STORAGE PRIVACY",
                (25, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 135),
                1,
                cv2.LINE_AA,
            )
            # FPS top-right
            cv2.putText(
                frame,
                f"FPS: {current_fps}",
                (w - 120, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 242, 254),
                1,
                cv2.LINE_AA,
            )

            # Form banner bottom
            if target_lost:
                cv2.putText(
                    frame,
                    "[!] TARGET LOST - PAUSED",
                    (int(w * 0.35), h - 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (0, 184, 255),
                    2,
                    cv2.LINE_AA,
                )
            elif not state.get("is_form_valid", True) and state.get("form_error"):
                cv2.putText(
                    frame,
                    f"[!] {state['form_error']}",
                    (int(w * 0.28), h - 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (68, 68, 255),
                    2,
                    cv2.LINE_AA,
                )
            elif features.is_active and not features.is_paused:
                cv2.putText(
                    frame,
                    "FORM OPTIMAL",
                    (int(w * 0.42), h - 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 135),
                    2,
                    cv2.LINE_AA,
                )

            # Encode frame to JPEG
            ret, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if ret:
                last_frame_bytes = buffer.tobytes()

        if last_frame_bytes:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + last_frame_bytes + b"\r\n"
            )

        time.sleep(0.015)


# ==========================================
# Application Routes & REST API
# ==========================================

@app.route("/")
def index():
    """Serve the single-page application interface."""
    return render_template("index.html")


@app.route("/api/profile", methods=["GET", "POST"])
def profile_endpoint():
    """Retrieve or update athlete profile configuration."""
    if request.method == "POST":
        data = request.get_json() or {}
        updated = user_manager.save_profile(data)
        with lock:
            features.set_user_profile(
                weight_kg=float(updated.get("weight_kg", 70.0)),
                height_cm=float(updated.get("height_cm", 175.0)),
                age=int(updated.get("age", 25)),
                gender=str(updated.get("gender", "male")),
            )
        return jsonify({"status": "success", "profile": updated})
    
    return jsonify({"status": "success", "profile": user_manager.get_profile()})


@app.route("/api/cameras", methods=["GET"])
def get_available_cameras():
    """Scan and list available OpenCV camera indices."""
    available = []
    # Test first 5 camera indices
    for i in range(5):
        try:
            # Short test open
            temp_cap = cv2.VideoCapture(i)
            if temp_cap.isOpened():
                available.append(i)
                temp_cap.release()
        except Exception:
            pass

    # Ensure current camera index is in the list
    if current_camera_index not in available:
        available.append(current_camera_index)
    available.sort()

    return jsonify({
        "status": "success",
        "cameras": available,
        "current": current_camera_index
    })


@app.route("/api/cameras/select", methods=["POST"])
def select_camera():
    """Switch active camera index dynamically."""
    global camera_capture, current_camera_index
    data = request.get_json() or {}
    idx = data.get("index")
    if idx is not None:
        try:
            idx = int(idx)
            with lock:
                current_camera_index = idx
                if camera_capture is not None:
                    camera_capture.stop()
                    camera_capture = None
            return jsonify({"status": "success", "selected": idx})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 400
    return jsonify({"status": "error", "message": "No camera index specified"}), 400


@app.route("/api/video_feed")
def video_feed():
    """MJPEG stream endpoint."""
    return Response(
        generate_video_stream(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/api/telemetry")
def telemetry_endpoint():
    """Real-time JSON telemetry stream for the Studio sidebar."""
    with lock:
        state = biomechanics._build_state_dict()
        duration_sec = features.get_duration_sec()
        burn_rate, intensity = features.get_live_burn_rate_and_intensity(state)

        return jsonify({
            "exercise_type": current_exercise,
            "exercise_name": state.get("exercise_name", "Push-up"),
            "current_state": state.get("current_state", "UP"),
            "total_reps": state.get("total_reps", 0),
            "valid_reps": state.get("valid_reps", 0),
            "invalid_reps": state.get("invalid_reps", 0),
            "form_score_pct": state.get("form_score_pct", 100.0),
            "is_form_valid": state.get("is_form_valid", True),
            "form_error": state.get("form_error"),
            "current_angle": round(state.get("current_angle", 180.0), 1),
            "avg_rom": round(state.get("avg_rom", 0.0), 1),
            "duration_sec": round(duration_sec, 1),
            "is_active": features.is_active,
            "is_paused": features.is_paused,
            "burn_rate_kcal_min": burn_rate,
            "intensity": intensity,
            "current_angular_velocity": state.get("current_angular_velocity", 0.0),
            "peak_angular_velocity": state.get("peak_angular_velocity", 0.0),
            "torso_inclination_angle": state.get("torso_inclination_angle", 0.0),
            "target_lost": state.get("target_lost", False),
            "fps": current_fps,
            "rep_rom_history": state.get("rep_rom_history", []),
        })


@app.route("/api/workout/start", methods=["POST"])
def start_workout():
    """Initialize a new workout set with chosen exercise."""
    global current_exercise, biomechanics
    data = request.get_json() or {}
    exercise = str(data.get("exercise", "pushup")).lower()
    if exercise not in EXERCISE_CONFIGS:
        exercise = "pushup"

    with lock:
        current_exercise = exercise
        biomechanics = BiomechanicsEngine(exercise_type=current_exercise)
        features.reset()
        features.start_set()

    return jsonify({
        "status": "success",
        "exercise": current_exercise,
        "message": f"Started {EXERCISE_CONFIGS[current_exercise].name} set",
    })


@app.route("/api/workout/pause", methods=["POST"])
def pause_workout():
    """Toggle pause state for the active workout set."""
    with lock:
        is_paused = features.pause_set()
    return jsonify({
        "status": "success",
        "is_paused": is_paused,
    })


@app.route("/api/workout/reset", methods=["POST"])
def reset_workout():
    """Reset counters and timers for the active workout set."""
    with lock:
        biomechanics.reset()
        features.reset()
        features.start_set()
    return jsonify({
        "status": "success",
        "message": "Workout counters and timer reset.",
    })


@app.route("/api/workout/end", methods=["POST"])
def end_workout():
    """Finalize active set, run ML inference, record to SQLite, and return analytics."""
    with lock:
        features.stop_set()
        state = biomechanics._build_state_dict()
        duration_sec = features.get_duration_sec()
        df_features = features.extract_features(state)
        predicted_kcal = ml_engine.predict(df_features)

        # Record to SQLite
        session_id = user_manager.record_session(
            exercise_type=current_exercise,
            exercise_name=state.get("exercise_name", "Push-up"),
            duration_sec=duration_sec,
            total_reps=state.get("total_reps", 0),
            valid_reps=state.get("valid_reps", 0),
            invalid_reps=state.get("invalid_reps", 0),
            valid_rep_ratio=float(df_features["valid_rep_ratio"].iloc[0]),
            avg_rom_deg=state.get("avg_rom", 0.0),
            rep_velocity=float(df_features["rep_velocity"].iloc[0]),
            form_score_pct=state.get("form_score_pct", 100.0),
            predicted_kcal=predicted_kcal,
            rep_rom_history=state.get("rep_rom_history", []),
        )

    lower_kcal, point_kcal, upper_kcal = predicted_kcal

    return jsonify({
        "status": "success",
        "session_id": session_id,
        "summary": {
            "exercise_name": state.get("exercise_name", "Push-up"),
            "exercise_type": current_exercise,
            "duration_sec": round(duration_sec, 1),
            "total_reps": state.get("total_reps", 0),
            "valid_reps": state.get("valid_reps", 0),
            "invalid_reps": state.get("invalid_reps", 0),
            "form_score_pct": state.get("form_score_pct", 100.0),
            "avg_rom_deg": round(state.get("avg_rom", 0.0), 1),
            "rep_velocity": round(float(df_features["rep_velocity"].iloc[0]), 1),
            "kcal_lower": lower_kcal,
            "kcal_point": point_kcal,
            "kcal_upper": upper_kcal,
            "rep_rom_history": state.get("rep_rom_history", []),
        },
    })


@app.route("/api/history")
def history_endpoint():
    """Retrieve past workout sessions and aggregate KPIs."""
    sessions = user_manager.get_recent_sessions(limit=30)
    stats = user_manager.get_aggregate_stats()
    return jsonify({
        "status": "success",
        "sessions": sessions,
        "stats": stats,
    })


@app.route("/api/export")
def export_endpoint():
    """Export workout session logs as JSON or CSV."""
    fmt = request.args.get("format", "json").lower()
    sessions = user_manager.get_recent_sessions(limit=1000)

    if fmt == "csv":
        output = io.StringIO()
        fieldnames = [
            "id", "timestamp", "exercise_type", "exercise_name",
            "duration_sec", "total_reps", "valid_reps", "invalid_reps",
            "valid_rep_ratio", "avg_rom_deg", "rep_velocity",
            "form_score_pct", "kcal_lower", "kcal_point", "kcal_upper"
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in sessions:
            writer.writerow(row)

        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment;filename=burn_ex_workout_history.csv"},
        )

    # Default: JSON export
    return Response(
        json.dumps(sessions, indent=2),
        mimetype="application/json",
        headers={"Content-Disposition": "attachment;filename=burn_ex_workout_history.json"},
    )


if __name__ == "__main__":
    print("[*] Launching Burn-Ex Web Studio on http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
