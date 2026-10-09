# Burn-Ex — AI-Powered Personalized Fitness Intelligence

> **Move Better. Burn Smarter.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.2+-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0+-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0+-D71F00?style=flat-square&logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.0+-EB5424?style=flat-square&logo=xgboost&logoColor=white)](https://xgboost.readthedocs.io/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-0.10+-0078D4?style=flat-square&logo=google&logoColor=white)](https://developers.google.com/mediapipe)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4.3+-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

Burn-Ex is an **AI-powered, privacy-first fitness intelligence platform** designed to eliminate the guesswork in workout tracking and energy expenditure estimation. 

Traditional fitness trackers rely almost exclusively on static Metabolic Equivalent of Task (MET) multipliers and generic duration timers—assuming that two individuals performing 20 repetitions burn identical energy regardless of form, speed, or range of motion.

Burn-Ex bridges computer vision, biomechanical signal processing, and a **Physics-Informed Residual Machine Learning architecture** to measure **how an athlete actually moves in real time**. Using privacy-preserving edge landmark detection, a debounced hysteresis state machine, and a custom XGBoost regression model, Burn-Ex extracts kinematic telemetry, validates exercise form, counts valid repetitions, and computes personalized calorie expenditure dynamically.

---

## 📌 Table of Contents

- [Key Features](#-key-features)
- [Screenshots & Visual Preview](#-screenshots--visual-preview)
- [Technology Stack](#-technology-stack)
- [System Architecture](#-system-architecture)
- [How It Works](#-how-it-works)
- [Repository Structure](#-repository-structure)
- [Prerequisites](#-prerequisites)
- [Installation & Local Setup](#-installation--local-setup)
- [Environment Variables](#-environment-variables)
- [API Documentation](#-api-documentation)
- [Database Architecture](#-database-architecture)
- [AI Model & Dataset](#-ai-model--dataset)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Security & Privacy Engineering](#-security--privacy-engineering)
- [Known Limitations & Roadmap](#-known-limitations--roadmap)
- [Contributing & License](#-contributing--license)

---

## ⚡ Key Features

- **Real-Time 3D Pose Estimation**: Extracts 33 skeletal landmarks using MediaPipe Pose Landmarker Lite/Full with Exponential Moving Average (EMA) spatial smoothing ($\alpha=0.65$) to eliminate micro-jitter.
- **Biomechanical Joint & Posture Tracking**: Computes real-time 3D joint angles (elbows, knees, hips) and torso inclination angles relative to vertical axes using vectorized Euclidean dot products.
- **Debounced Hysteresis Repetition Counting**: State-machine architecture enforcing dynamic angle buffers (e.g. $160^\circ$ UP, $80^\circ$ DOWN for pushups) and minimum state-hold times ($300\text{ ms}$) to prevent false rep triggers and rapid micro-pauses.
- **Form Quality Validation**: Continuously checks posture constraints (e.g., sagging hips, incomplete range of motion) to categorize repetitions into valid vs. invalid reps with instant HUD feedback.
- **Physics-Informed Residual Calorie Estimation**: Blends personalized Mifflin-St Jeor Basal Metabolic Rate (BMR) and standard MET baselines with a trained XGBoost residual model that predicts a dynamic form multiplier ($M_{\text{form}} \in [0.6, 1.4]$) and $95\%$ prediction intervals.
- **Live WebSocket Telemetry**: Streams real-time frame kinematics, repetition status, current stage, and instant form accuracy percentages to the React interface at low latency.
- **Authoritative MySQL 8.0+ Persistence**: Production-grade relational database managed with SQLAlchemy 2.x asynchronous sessions (`asyncmy`) and Alembic migrations for users, workouts, leaderboard, AI plans, and OTP verification records.
- **Aggregated Analytics & History**: Indexed SQL queries computing daily calorie metrics, 15-day activity trends, workout history pagination, and global leaderboard rankings.
- **AI Fitness & Nutrition Coaching**: Conversational AI Coach powered by Google Gemini 2.5 Flash (with deterministic local coach fallback) contextualized with the user's physical profile, recent sessions, and dietary preferences.
- **Deterministic Workout & Nutrition Planner**: Generates personalized daily circuits and macronutrient targets based on target goals (Hypertrophy, Fat Loss, Endurance, General Fitness).
- **Secure Authentication**: Firebase Authentication for token validation, Google OAuth, and Phone OTP verification with SHA-256 hashed code records.

---

## 📸 Screenshots & Visual Preview

| Push-up Tracking & HUD | Interactive Athlete Dashboard |
|:---:|:---:|
| ![Push-up Tracking](frontend/public/athlete_pushup.png) | ![Athlete Dashboard](main_model/brave_screenshot.png) |
| *Real-time landmark detection and joint angle estimation* | *Kinematics telemetry, analytics, and session history* |

> *Note: UI captures showcase the live MediaPipe skeletal overlay, debounced repetition state transitions, and real-time HUD telemetry.*

---

## 🛠 Technology Stack

| Category | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend Framework** | React | `^19.2.8` | Component-driven user interface and reactive state |
| **Frontend Build Tool** | Vite | `^8.2.0` | High-performance build tool and local development server |
| **Styling** | Tailwind CSS | `^4.3.3` | Modern, responsive dark-mode styling and animations |
| **Icons** | Lucide React | `^1.31.0` | Iconography suite for dashboard and HUD |
| **Backend Framework** | FastAPI | `>=0.100.0` | Asynchronous high-performance REST APIs and WebSockets |
| **ASGI Server** | Uvicorn | `>=0.23.0` | High-throughput asynchronous server |
| **Computer Vision** | OpenCV | `>=4.8.0` | Video frame capture, color conversions, and image processing |
| **Pose Estimation** | Google MediaPipe | `>=0.10.0` | 33 3D skeletal landmark extraction (Lite & Full models) |
| **Machine Learning** | XGBoost | `>=2.0.0` | Physics-informed residual calorie regression model |
| **Data & Numerics** | NumPy & Pandas | `>=1.24.0` / `>=2.0.0` | Vectorized 3D geometry math and feature extraction |
| **Primary Database** | MySQL | `8.0+` | Authoritative relational data persistence (InnoDB, utf8mb4) |
| **Database ORM** | SQLAlchemy | `>=2.0.0` | Async Declarative ORM and async session management |
| **Async MySQL Driver** | `asyncmy` | `>=0.2.8` | Fast asynchronous DBAPI driver for SQLAlchemy |
| **Database Migrations**| Alembic | `>=1.13.0` | Version-controlled schema migrations |
| **Authentication** | Firebase Admin SDK | `>=5.0.0` | Secure JWT token verification and OAuth lifecycle |
| **AI Coach Engine** | Google Gemini API | `2.5-flash` | Personalized LLM fitness coach with memory and profile context |
| **Testing** | Python `unittest` | Built-in | Async test suite for API, persistence, migrations, and ML |

---

## 🏗 System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client (Browser / React 19)"]
        Camera["Webcam Video Stream"]
        UI["React 19 Dashboard & HUD"]
        AuthClient["Firebase Auth (Google / Email / Phone)"]
    end

    subgraph BackendGateway ["FastAPI Gateway (Uvicorn Async)"]
        AuthMiddleware["Token Verifier & RBAC Security"]
        WSEndpoint["WebSocket /ws/live-workout"]
        RESTEndpoints["REST API Endpoints (/api/profile, /api/history, ...)"]
    end

    subgraph AIPipeline ["AI & Biomechanics Pipeline"]
        MediaPipe["MediaPipe Pose (33 Landmarks)"]
        Smoother["EMA Spatial Smoother (α=0.65)"]
        BiomechanicsEngine["Debounced Hysteresis State Machine"]
        FeatureExtractor["Kinematic Feature Extractor"]
        XGBoostEngine["Physics-Informed Residual XGBoost Model"]
    end

    subgraph ExternalServices ["External Services"]
        GeminiAPI["Google Gemini 2.5 Flash API"]
        TwilioSMS["Twilio SMS Gateway (Optional)"]
        Cloudinary["Cloudinary CDN (Optional)"]
    end

    subgraph Persistence ["Primary Relational Storage"]
        SQLAlchemy["SQLAlchemy 2.x Async Engine"]
        MySQL[("MySQL 8.0+ Database\n• users\n• workouts\n• leaderboard\n• ai_plans\n• otp_verifications")]
    end

    %% Client Interactions
    Camera -->|RGB Frames| WSEndpoint
    AuthClient -->|JWT ID Token| AuthMiddleware
    UI <-->|Bi-directional Telemetry| WSEndpoint
    UI <-->|JSON Requests / Responses| RESTEndpoints

    %% Gateway to Services
    AuthMiddleware --> RESTEndpoints
    AuthMiddleware --> WSEndpoint
    WSEndpoint --> MediaPipe
    RESTEndpoints --> SQLAlchemy
    RESTEndpoints <--> GeminiAPI
    RESTEndpoints <--> TwilioSMS
    RESTEndpoints <--> Cloudinary

    %% AI Pipeline Flow
    MediaPipe --> Smoother
    Smoother --> BiomechanicsEngine
    BiomechanicsEngine --> FeatureExtractor
    FeatureExtractor --> XGBoostEngine
    BiomechanicsEngine -->|Live HUD State| WSEndpoint
    XGBoostEngine -->|Final Calorie Bounds| WSEndpoint

    %% Persistence Flow
    WSEndpoint -.->|Session Complete| SQLAlchemy
    SQLAlchemy <--> MySQL
```

---

## ⚙️ How It Works

```
[Webcam Frame] 
      │
      ▼
[MediaPipe Pose] ───► [EMA Coordinate Smoothing (α=0.65)]
                              │
                              ▼
                   [3D Vector Joint Angles] ───► [Torso Inclination Check]
                              │
                              ▼
            [Debounced Hysteresis State Machine]
             ├─ UP State: Angle > 160°
             ├─ DOWN State: Angle < 80°
             └─ Form Validation: Spine Angle > 150°
                              │
                              ▼
                [Repetition Count + Form Flag]
                              │
                              ▼ (On Workout Completion)
            [Temporal Kinematic Feature Aggregation]
             ├─ ROM Completeness Ratio
             ├─ Peak Angular Velocity
             ├─ Rep Cadence Variance
             └─ Valid Rep Ratio
                              │
                              ▼
            [Physics-Informed Residual XGBoost Inference]
             Formula: K_total = K_base × M_form
             ├─ K_base = MET × (BMR / 24) × (Duration / 3600)
             └─ M_form ∈ [0.6, 1.4] (Predicted by XGBoost)
                              │
                              ▼
            [SQLAlchemy AsyncSession Commit to MySQL 8.0+]
```

### Calorie Estimation Methodology
1. **Base Energy Expenditure ($K_{\text{base}}$)**: Calculated using the user's personalized Basal Metabolic Rate via the Mifflin-St Jeor equation and standard exercise MET reference values:
   $$\text{BMR}_{\text{male}} = 10 \cdot W + 6.25 \cdot H - 5 \cdot A + 5$$
   $$\text{BMR}_{\text{female}} = 10 \cdot W + 6.25 \cdot H - 5 \cdot A - 161$$
   $$K_{\text{base}} = \text{MET} \times \left(\frac{\text{BMR}}{24}\right) \times \left(\frac{\text{Duration}_{\text{sec}}}{3600}\right)$$
2. **Form & Intensity Multiplier ($M_{\text{form}}$)**: A gradient-boosted regression tree (XGBoost) predicts $M_{\text{form}} \in [0.6, 1.4]$ based on extracted kinematic features (ROM, angular velocity, cadence variance, valid repetition ratio).
3. **Total Calorie Output**:
   $$K_{\text{total}} = K_{\text{base}} \times M_{\text{form}}$$
   *Uncertainty bounds ($95\%$ prediction interval) are computed dynamically from tracking confidence and form variance.*

---

## 📂 Repository Structure

```text
Burn-Ex/
├── backend/
│   ├── alembic/                    # Alembic async migration suite
│   │   ├── versions/               # Schema version scripts
│   │   │   └── 001_initial_mysql_schema.py
│   │   └── env.py                  # Async migration runner
│   ├── data/                       # Datasets and reference files
│   │   ├── raw_sessions.csv        # Baseline training telemetry
│   │   └── reference_baselines.csv # Exercise MET and angle thresholds
│   ├── db/                         # Database layer
│   │   ├── database.py             # Async engine, sessionmaker, lifecycle
│   │   ├── models.py               # SQLAlchemy 2.x declarative models
│   │   ├── schemas.py              # Pydantic v2 validation schemas
│   │   └── user_repository.py      # Async MySQL repository operations
│   ├── models/                     # Serialized AI model artifacts
│   │   ├── burn_ex_xgboost.pkl     # Trained XGBoost residual model
│   │   ├── pose_landmarker_lite.task
│   │   └── pose_landmarker_full.task
│   ├── scripts/                    # Utilities and migrations
│   │   └── migrate_mongo_to_mysql.py # Legacy MongoDB data migrator
│   ├── services/                   # Application domain services
│   │   └── otp_service.py          # Secure OTP generator & verifier
│   ├── src/                        # Core AI & computer vision modules
│   │   ├── biomechanics.py         # 3D angles, kinematics, hysteresis state
│   │   ├── config.py               # Application configuration & thresholds
│   │   ├── feature_extractor.py    # Temporal kinematic feature extraction
│   │   ├── gemini_service.py       # Google Gemini 2.5 Flash AI Coach
│   │   ├── local_coach.py          # Deterministic offline coach fallback
│   │   ├── ml_engine.py            # Physics-informed XGBoost engine
│   │   ├── ui_renderer.py          # OpenCV HUD drawing utilities
│   │   ├── user_manager.py         # Local session and profile manager
│   │   ├── video_stream.py         # Threaded camera video stream
│   │   ├── vision_pipeline.py      # MediaPipe pose extraction & EMA
│   │   └── workout_planner.py      # Dynamic circuit & workout generator
│   ├── tests/                      # Unittest test suite
│   │   ├── test_alembic_migrations.py
│   │   ├── test_biomechanics.py
│   │   ├── test_mysql_persistence.py
│   │   ├── test_user_manager.py
│   │   └── test_web_api.py
│   ├── .env.example                # Backend environment template
│   ├── alembic.ini                 # Alembic configuration
│   ├── api.py                      # FastAPI application entry point & routes
│   ├── main.py                     # Desktop CLI workout runner
│   └── requirements.txt            # Python dependencies
├── frontend/
│   ├── public/                     # Static public assets & images
│   ├── src/
│   │   ├── components/             # React UI components
│   │   │   ├── AICoach.jsx         # Conversational AI Coach
│   │   │   ├── Analytics.jsx       # Calorie & workout charts
│   │   │   ├── CompleteProfile.jsx # Biometrics onboarding form
│   │   │   ├── History.jsx         # Workout session history
│   │   │   ├── Leaderboard.jsx     # Global rankings table
│   │   │   ├── LoginPage.jsx       # Firebase authentication UI
│   │   │   ├── NutritionPlan.jsx   # Personalized meal plans
│   │   │   ├── Profile.jsx         # User profile manager
│   │   │   ├── VideoWorkout.jsx    # Real-time workout tracker & HUD
│   │   │   └── WorkoutPlan.jsx     # Daily circuit generator
│   │   ├── App.jsx                 # Application root & routing
│   │   ├── firebase.js             # Firebase client configuration
│   │   └── index.css               # Tailwind CSS stylesheet
│   ├── .env.example                # Frontend environment template
│   ├── package.json                # Frontend dependencies
│   └── vite.config.js              # Vite bundler configuration
├── LICENSE                         # MIT License
└── README.md                       # Project documentation
```

---

## 📋 Prerequisites

Before running Burn-Ex locally, ensure you have the following installed:

- **Python**: Version `3.10` or `3.11` (Tested on Python 3.11)
- **Node.js**: Version `18.0.0` or higher (`npm` version 9.0+)
- **MySQL Server**: Version `8.0` or higher (or compatible MariaDB 10.5+)
- **Webcam / Camera**: Built-in or external USB camera for live pose tracking
- **Git**: For source control

---

## 🚀 Installation & Local Setup

### 1. Clone the Repository
```bash
git clone https://github.com/sanjai0305/Burn-Ex.git
cd Burn-Ex
```

### 2. Configure the MySQL Database
Create a dedicated MySQL database and user with least-privilege permissions:

```sql
CREATE DATABASE IF NOT EXISTS burn_ex CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'burnex_user'@'localhost' IDENTIFIED BY 'burnex_password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER ON burn_ex.* TO 'burnex_user'@'localhost';
FLUSH PRIVILEGES;
```

---

### 3. Backend Setup

#### Windows (PowerShell)
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

#### Linux / macOS (Bash)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

#### Run Alembic Database Migrations
Initialize the relational schema on your MySQL instance:
```bash
alembic upgrade head
```

#### Start the FastAPI Backend Server
```bash
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```
*The backend API will be available at `http://localhost:8000` with interactive Swagger docs at `http://localhost:8000/docs`.*

---

### 4. Frontend Setup

In a new terminal window:

```bash
cd frontend
npm install
```

#### Configure Frontend Environment
```bash
# Windows
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```
*Edit `frontend/.env` to configure your Firebase project credentials and set `VITE_API_BASE=http://localhost:8000`.*

#### Start the Vite Development Server
```bash
npm run dev
```
*The web application will open on `http://localhost:5173`.*

---

## 🔐 Environment Variables

### Backend Configuration (`backend/.env`)

| Variable | Description | Required | Default / Example |
|---|---|---|---|
| `ENV` | Application environment (`development`, `production`, `test`) | Yes | `development` |
| `ALLOW_DEV_TOKENS` | Enable mock tokens for automated testing & development | No | `true` |
| `DATABASE_URL` | SQLAlchemy async connection URL | **Yes** | `mysql+asyncmy://burnex_user:burnex_password@localhost:3306/burn_ex?charset=utf8mb4` |
| `MYSQL_HOST` | MySQL hostname | No | `localhost` |
| `MYSQL_PORT` | MySQL port | No | `3306` |
| `MYSQL_USER` | MySQL database user | No | `burnex_user` |
| `MYSQL_PASSWORD` | MySQL database password | No | `burnex_password` |
| `MYSQL_DATABASE` | MySQL database name | No | `burn_ex` |
| `FIREBASE_PROJECT_ID` | Firebase project ID for token verification | No | `burn-ex-a4591` |
| `FIREBASE_KEY_PATH` | Path to Firebase service account JSON | No | `firebase-key.json` |
| `GEMINI_API_KEY` | Google AI Studio API key for Gemini Coach | No | *(Optional)* |
| `GEMINI_MODEL` | Gemini LLM model identifier | No | `gemini-2.5-flash` |
| `OTP_PROVIDER` | Phone verification provider (`mock` or `twilio`) | No | `mock` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID for live SMS | No | *(Optional)* |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token for live SMS | No | *(Optional)* |
| `TWILIO_FROM_NUMBER` | Twilio SMS sender phone number | No | *(Optional)* |
| `CLOUDINARY_CLOUD_NAME`| Cloudinary cloud name for avatar hosting | No | *(Optional)* |

### Frontend Configuration (`frontend/.env`)

| Variable | Description | Required | Default / Example |
|---|---|---|---|
| `VITE_API_BASE` | FastAPI backend URL | **Yes** | `http://localhost:8000` |
| `VITE_FIREBASE_API_KEY` | Firebase Client API Key | **Yes** | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | **Yes** | `burn-ex-a4591.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | **Yes** | `burn-ex-a4591` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | No | `burn-ex-a4591.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Sender ID | No | `1234567890` |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID | **Yes** | `1:1234567890:web:...` |

---

## 📖 API Documentation

The FastAPI backend exposes fully documented REST endpoints and a real-time WebSocket interface. Interactive documentation is available at `http://localhost:8000/docs`.

### Key Endpoints

| Method | Route | Description | Auth Required |
|---|---|---|---|
| `GET` | `/` | Service health status and version metadata | No |
| `GET` | `/api/health` | Comprehensive health check (Database, ML model, Vision) | No |
| `GET` | `/api/profile` | Retrieve authenticated athlete profile | **Yes (Bearer JWT)** |
| `POST` | `/api/profile` | Atomic upsert of athlete profile in MySQL | **Yes (Bearer JWT)** |
| `GET` | `/api/profile/check` | Fast profile existence check for onboarding redirects | **Yes (Bearer JWT)** |
| `POST` | `/api/profile/create` | Initial athlete registration with mobile uniqueness checks | **Yes (Bearer JWT)** |
| `POST` | `/api/profile/update` | Update user biometric parameters and fitness goals | **Yes (Bearer JWT)** |
| `POST` | `/api/profile/send-otp` | Generate and dispatch phone verification OTP | No (Rate-Limited) |
| `POST` | `/api/profile/verify-otp`| Verify phone OTP code and update verified status | No |
| `POST` | `/api/workout/end` | Persist completed workout, kinematics, and calories | **Yes (Bearer JWT)** |
| `GET` | `/api/history` | Paginated user workout history with date filtering | **Yes (Bearer JWT)** |
| `GET` | `/api/analytics/today` | Aggregate today's calories, reps, and workout duration | **Yes (Bearer JWT)** |
| `GET` | `/api/analytics/15days`| 15-day chronological calorie burn and rep trends | **Yes (Bearer JWT)** |
| `GET` | `/api/leaderboard` | Global athlete rankings sorted by total calories burned | No |
| `POST` | `/api/ai/coach` | Interact with the Gemini 2.5 Flash AI Fitness Coach | **Yes (Bearer JWT)** |
| `GET` | `/api/ai/plan` | Fetch saved personalized AI workout plan | **Yes (Bearer JWT)** |
| `POST` | `/api/generate-plan` | Generate and persist customized daily fitness plan | **Yes (Bearer JWT)** |
| `GET` | `/api/admin/system-stats`| Administrative system metrics and telemetry | **Yes (Admin RBAC)** |
| `WS` | `/ws/live-workout` | Low-latency live video frame processing & HUD telemetry | Optional Token |

---

## 🗄 Database Architecture

Burn-Ex uses **MySQL 8.0+** as its authoritative relational database. The schema is fully normalized, indexed for high-frequency queries, and managed via Alembic migrations.

### Relational Entity Model

```mermaid
erDiagram
    users ||--o{ workouts : "records"
    users ||--o| leaderboard : "ranks"
    users ||--o| ai_plans : "owns"

    users {
        bigint id PK
        varchar firebase_uid UK
        varchar email
        varchar name
        int age
        varchar gender
        float height_cm
        float weight_kg
        varchar fitness_goal
        varchar avatar_url
        varchar mobile_number UK
        varchar role
        boolean is_verified
        boolean profile_completed
        datetime created_at
        datetime updated_at
    }

    workouts {
        bigint id PK
        varchar workout_id UK
        bigint user_id FK
        varchar firebase_uid
        varchar exercise_type
        varchar exercise_name
        date workout_date
        float duration_seconds
        int total_reps
        int valid_reps
        int invalid_reps
        float valid_rep_ratio
        float avg_rom_deg
        float rep_velocity
        float form_accuracy_score
        float calories_burned
        float predicted_kcal
        json kinematics_data
        json prediction_bounds
        varchar status
        datetime completed_at
        datetime created_at
    }

    leaderboard {
        bigint id PK
        bigint user_id FK
        varchar firebase_uid UK
        varchar athlete_alias
        float total_kcal_burned
        float global_form_score_avg
        int total_valid_reps
        int total_workouts
        datetime last_workout_timestamp
        datetime updated_at
    }

    ai_plans {
        bigint id PK
        bigint user_id FK
        varchar firebase_uid UK
        json plan_data
        datetime updated_at
    }

    otp_verifications {
        bigint id PK
        varchar phone
        varchar otp_hash
        varchar purpose
        int attempts
        boolean is_verified
        datetime expires_at
        datetime created_at
    }
```

---

## 🧪 AI Model & Dataset

- **Model Type**: Physics-Informed Residual XGBoost Regressor (`XGBRegressor`)
- **Residual Features**:
  1. `peak_angular_velocity`: Maximum joint angular speed in deg/sec.
  2. `rom_completeness_ratio`: Measured ROM relative to target ideal ROM baseline.
  3. `torso_inclination_angle`: Torso alignment relative to vertical vector.
  4. `rep_cadence_variance`: Consistency of repetition execution intervals.
  5. `rep_velocity`: Repetition rate in reps per minute.
  6. `valid_rep_ratio`: Fraction of valid reps over total detected attempts.
  7. One-hot encoded exercise indicators (`is_pushup`, `is_squat`, `is_jumping_jack`).
- **Dataset Origin**: Calibrated using standard MET physical baseline references (`data/reference_baselines.csv`) and structured movement sessions (`data/raw_sessions.csv`).
- **Inference Guarantee**: Zero raw RGB video frames are stored to disk or transmitted across network boundaries. Frames are processed in volatile memory and immediately discarded.

---

## 🧪 Testing & Quality Assurance

Burn-Ex includes a comprehensive automated test suite covering unit, persistence, integration, and security checks.

### Running Backend Tests
```bash
cd backend
python -m unittest discover -s tests -v
```

**Verified Test Coverage (31 Tests Passing)**:
- `test_alembic_migrations`: Alembic parsing and metadata model registration.
- `test_biomechanics`: 3D joint angles, torso inclination, debounce filtering, and hysteresis state machine.
- `test_mysql_persistence`: User CRUD, mobile uniqueness, workout idempotency, SQL aggregation analytics, leaderboard rankings, and transaction rollback safety.
- `test_user_manager`: Local session recording and profile management.
- `test_web_api`: JWT verification, RBAC admin enforcement, protected endpoint authorization, phone OTP rate-limiting, and workout persistence lifecycle.

### Running Frontend Production Build
```bash
cd frontend
npm run build
```
*Builds production bundles using Vite and validates zero syntax or type regressions.*

---

## 🔒 Security & Privacy Engineering

1. **Zero Video Storage**: RGB camera frames are processed directly in volatile memory via MediaPipe and immediately overwritten in the next frame loop. Video is never saved to disk or cloud storage.
2. **Robust Authentication**: Backend validates cryptographically signed Firebase JWTs, checking signature authenticity, audience matching, and expiration.
3. **Database Security & Least Privilege**: Credentials are strictly read from environment variables (`.env`). No database credentials are committed to version control.
4. **Hashed Verification Records**: Phone verification OTPs are hashed using SHA-256 before storage in `otp_verifications` with strict attempt limits (max 5) and short expiry windows (10 minutes).
5. **Role-Based Access Control (RBAC)**: Administrative endpoints (`/api/admin/*`) strictly enforce `role == "admin"` authorization checks.

---

## 🗺 Known Limitations & Roadmap

### Current Limitations
- **Exercise Scope**: Real-time debounced state machines are currently calibrated for **Push-ups**, **Squats**, and **Jumping Jacks**.
- **Single-Athlete Focus**: The vision pipeline is optimized for single-person workout framing.
- **Lighting & Occlusion**: Landmark accuracy depends on clear full-body visibility and adequate lighting.

### Development Roadmap
- [x] Complete MongoDB removal and MySQL 8.0+ migration.
- [x] Implement Alembic async migrations.
- [x] Standardize SQLAlchemy 2.x async session management.
- [x] Add phone OTP verification with rate limiting.
- [ ] Add support for Pull-ups, Lunges, and Planks.
- [ ] Multi-person occlusion handling with ByteTrack.
- [ ] Native mobile wrapper using React Native or Capacitor.
- [ ] Wearable heart rate monitor integration (BLE / Apple Health / Google Fit).

---

## 🤝 Contributing & License

Contributions, issues, and feature requests are welcome!

1. Fork the Project (`https://github.com/sanjai0305/Burn-Ex/fork`)
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### License
Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

### Acknowledgements
- [Google MediaPipe](https://developers.google.com/mediapipe) for pose estimation.
- [OpenCV](https://opencv.org/) for computer vision utilities.
- [FastAPI](https://fastapi.tiangolo.com/) for modern Python web APIs.
- [SQLAlchemy](https://www.sqlalchemy.org/) & [Alembic](https://alembic.sqlalchemy.org/) for relational database persistence.
- [Tailwind CSS](https://tailwindcss.com/) for UI styling.
