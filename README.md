# Burn-Ex — AI-Powered Biomechanics & Fitness Analytics Platform

[![Vite](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![MySQL](https://img.shields.io/badge/Database-Amazon%20RDS%20MySQL-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![AWS](https://img.shields.io/badge/Infrastructure-AWS%20EC2%20%7C%20S3%20%7C%20SSM-232F3E?logo=amazon-aws&logoColor=white)](https://aws.amazon.com)
[![Build & Deploy](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions%20OIDC-2088FF?logo=github-actions&logoColor=white)](https://github.com/features/actions)

Burn-Ex is an advanced, production-grade fitness SaaS platform that delivers real-time computer vision biomechanics tracking, edge AI pose estimation, personalized AI coaching via Google Gemini 2.5 Flash, and complete subscription management.

[Architecture Documentation](docs/architecture.md) • [AWS Deployment Guide](docs/deployment-aws.md) • [API Health Endpoint](http://localhost:8000/health)

---

## 1. Project Overview

Burn-Ex combines client-side MediaPipe/TensorFlow.js pose detection with a high-performance Python FastAPI backend to track user exercise biomechanics, count repetitions with state-machine hysteresis, evaluate form quality, calculate real metabolic expenditure (BMR & MET), and deliver AI-driven workout recommendations.

### Key Capabilities
- **Edge AI & Computer Vision**: Zero-latency pose tracking and 2D canvas skeleton overlay using MediaPipe + TensorFlow.js.
- **Biomechanical Analytics Engine**: Server-side XGBoost & TFLite rep classification, joint angle computation, and form error alerts.
- **AI Coach (Google Gemini 2.5 Flash)**: Contextual fitness advice, dynamic circuit generation, and automated nutrition plans.
- **Pro SaaS Subscription & Payments**: Razorpay integration (`₹499/month`) with server-side HMAC SHA256 signature verification and 30-day free trial options.
- **100% MySQL Persistence**: Relational storage for users, workout sessions, AI plans, notifications, achievements, and leaderboards using SQLAlchemy 2.x ORM.
- **Indian Phone Number Validation**: Standardized 10-digit Indian mobile number validation (`+91`) with India flag indicator and local OTP verification.

---

## 2. Technology Stack

| Domain | Technologies Used |
| :--- | :--- |
| **Frontend SPA** | React 18, Vite 5, TailwindCSS, Lucide Icons, Canvas API |
| **Edge AI Inference** | MediaPipe Pose, TensorFlow.js, WebSockets (`ws://`) |
| **Backend Framework** | Python 3.11, FastAPI, Uvicorn, Pydantic, OpenCV, NumPy |
| **Database & ORM** | MySQL 8.0+, SQLAlchemy 2.x, PyMySQL |
| **Authentication** | Firebase Authentication (Bearer JWT Verification) |
| **AI Integration** | Google Gemini 2.5 Flash API |
| **Payment Gateway** | Razorpay SDK (Order Creation, HMAC SHA256 Verification, Webhooks) |
| **Infrastructure & Cloud** | AWS EC2 (Ubuntu 22.04 LTS), Amazon RDS for MySQL, Nginx, Amazon S3, AWS SSM |
| **CI/CD Automation** | GitHub Actions, AWS OIDC Keyless Authentication, Systemd |

---

## 3. Architecture Overview

```mermaid
graph TD
    subgraph Client Layer
        A[React 18 / Vite Frontend] -->|HTTPS REST| B[Nginx Reverse Proxy]
        A -->|WSS WebSockets| B
    end

    subgraph AWS EC2 Application Instance
        B -->|Static Files| C[Built React SPA Bundle /dist]
        B -->|Proxy HTTP :8000| D[FastAPI Backend - Uvicorn]
        B -->|Proxy WS :8000| D
        
        subgraph FastAPI Core Engine
            D --> E[Vision Pipeline & Biomechanics Engine]
            D --> F[MLEngine - XGBoost / TFLite Rep Classifier]
            D --> G[Local & Gemini AI Coach Service]
            D --> H[SQLAlchemy 2.x ORM / Repository Layer]
        end
    end

    subgraph AWS Cloud Infrastructure & External Services
        H -->|Private Subnet :3306| I[(Amazon RDS for MySQL)]
        G -->|HTTPS API| J[Google Gemini 2.5 Flash API]
        D -->|HTTPS REST / HMAC| K[Razorpay Payment Gateway]
        A -->|Auth Tokens| L[Firebase Authentication]
    end
```

For full detailed component specifications and data flow diagrams, see [docs/architecture.md](docs/architecture.md).

---

## 4. Repository Structure

```text
Burn-Ex/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Frontend build & Backend unit tests workflow
│       └── deploy.yml             # AWS OIDC deployment workflow via S3 & SSM
├── backend/
│   ├── api.py                     # FastAPI application entry point & CORS configuration
│   ├── .env.example               # Backend environment variables template
│   ├── db/
│   │   ├── database.py            # SQLAlchemy 2.x engine, session, & auto-reconnect factory
│   │   ├── models.py              # Declarative ORM models (User, WorkoutSession, etc.)
│   │   └── mysql_repository.py    # Database repository data-access layer
│   ├── models/                    # ML model weights (XGBoost / TFLite pose classifiers)
│   ├── services/                  # OTP service, Gemini integration, user manager
│   ├── src/                       # Biomechanics engine, vision pipeline, feature extractor
│   └── tests/                     # Unit test suite for MySQL, API, & user manager
├── deploy/
│   ├── burnex-backend.service     # Systemd production service unit
│   ├── deploy.sh                  # Idempotent EC2 deployment bash script
│   └── nginx.conf                 # Production Nginx reverse-proxy configuration
├── docs/
│   ├── architecture.md            # Technical Architecture Specification
│   └── deployment-aws.md          # AWS EC2 & RDS MySQL Deployment Guide
├── frontend/
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── App.jsx                # Main application component & dashboard routing
│       ├── components/            # CompleteProfile, BurnExProModal, IndianPhoneInput, etc.
│       ├── hooks/                 # useWsWorkout, useProfileStatus, useCountdown
│       └── services/              # Client-side AI model inference & voice services
└── infra/
    └── terraform/                 # AWS Infrastructure as Code (EC2, RDS, S3, IAM OIDC)
        ├── main.tf
        ├── variables.tf
        ├── outputs.tf
        └── terraform.tfvars.example
```

---

## 5. Local Development Setup

### Prerequisites
- **Node.js**: `v20.x` or higher
- **Python**: `v3.11.x`
- **MySQL Server**: `8.0` or `8.4` listening on `127.0.0.1:3306`

### 5.1 Clone Repository & Setup Environment Files
```powershell
# Clone the repository
git clone https://github.com/your-username/burn-ex.git
cd burn-ex

# Copy environment templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 5.2 Configure Environment Variables
Edit `backend/.env`:
```env
MYSQL_URL=mysql+pymysql://root:password@127.0.0.1:3306/burnex_db
FIREBASE_PROJECT_ID=burn-x-7200b
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
RAZORPAY_KEY_ID=rzp_test_burnex_live_demo
RAZORPAY_KEY_SECRET=burnex_secret_demo_9918
```

### 5.3 Setup MySQL Database
Ensure your local MySQL service is running (`net start MySQL80`), then run:
```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS burnex_db;"
```

### 5.4 Install Backend Dependencies & Start FastAPI Server
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Run backend unit tests
python -m unittest discover -s tests

# Start FastAPI server
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

### 5.5 Install Frontend Dependencies & Start React Server
Open a new terminal:
```powershell
cd frontend
npm install
npm run dev
```
The application will open at `http://localhost:5173` and communicate with `http://localhost:8000`.

---

## 6. Environment Variables Reference

| Variable | Description | Location | Sample Value / Placeholder |
| :--- | :--- | :--- | :--- |
| `MYSQL_URL` | MySQL Connection URL | Backend `.env` | `mysql+pymysql://user:pass@127.0.0.1:3306/burnex_db` |
| `FIREBASE_PROJECT_ID` | Firebase Auth Project ID | Backend `.env` | `burn-x-7200b` |
| `GEMINI_API_KEY` | Google Gemini API Key | Backend `.env` | `AIzaSy...` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | Backend `.env` | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | Backend `.env` | `secret_...` |
| `VITE_API_BASE` | FastAPI Backend URL | Frontend `.env` | `http://localhost:8000` |

---

## 7. API Endpoints Overview

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server & MySQL Database Health Status | No |
| `GET` | `/api/user/stats` | Aggregated user dashboard metrics | Yes |
| `POST` | `/api/profile/check` | Verify user profile onboarding status | Yes |
| `POST` | `/api/profile/complete` | Save onboarding profile details | Yes |
| `POST` | `/api/payments/create-order` | Create Razorpay subscription order | Yes |
| `POST` | `/api/payments/verify-payment` | Verify HMAC payment signature | Yes |
| `POST` | `/api/coach/chat` | Query AI Coach (Gemini 2.5 Flash) | Yes |
| `WS` | `/ws/live-workout` | Real-time WebSocket camera telemetry | Yes |

---

## 8. Automated Testing & Production Deployment

### Run Backend Tests
```bash
cd backend
python -m unittest discover -s tests
```

### Run Frontend Production Build
```bash
cd frontend
npm run build
```

### AWS EC2 & RDS Deployment
Full instructions for deploying to AWS EC2 and Amazon RDS for MySQL using Terraform and GitHub Actions keyless OIDC can be found in **[docs/deployment-aws.md](docs/deployment-aws.md)**.

---

## 9. License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
