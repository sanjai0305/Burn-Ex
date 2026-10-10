# Burn-Ex — System Architecture & Technical Specification

## Executive Summary

Burn-Ex is an AI-powered biomechanics and metabolic expenditure inference SaaS platform. It combines real-time computer vision pose tracking, client-side MediaPipe/TensorFlow.js edge AI models, server-side FastAPI biomechanics analytics, Google Gemini LLM coaching, and Amazon RDS MySQL data persistence.

---

## 1. System Architecture Diagram

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

---

## 2. Component Details

### 2.1 Frontend Architecture (React 18 + Vite)
- **Single Page Application (SPA)**: Built with React 18, Vite, and TailwindCSS in a clean light-mode aesthetic.
- **Client-Side Vision Processing**: Implements `aiModelService.js` (TensorFlow.js + MediaPipe Pose) for zero-latency camera frame analysis, joint angle calculation, ROM (Range of Motion) scoring, and rep hysteresis state machine.
- **Real-Time Telemetry Stream**: `useWsWorkout.js` streams compressed video frames over WebSockets (`/ws/live-workout`) to the backend for server-side biomechanical verification.

### 2.2 Backend Architecture (FastAPI + SQLAlchemy 2.x)
- **API Server (`backend/api.py`)**: Asynchronous FastAPI server exposing RESTful endpoints for profile management, workouts, notifications, subscription status, AI Coach queries, and Razorpay order creation.
- **Resilient Engine Lifecycle (`backend/db/database.py`)**: Synchronous SQLAlchemy 2.x connection pool with dynamic health checks, auto-reconnection logic, and zero-downtime startup fallbacks.
- **Database Repository (`backend/db/mysql_repository.py`)**: Encapsulates 100% of application persistence using SQLAlchemy ORM models (`User`, `WorkoutSession`, `AIPlan`, `Notification`, `Leaderboard`, `Payment`, `Subscription`).

### 2.3 External Integrations
- **Firebase Authentication**: Validates user identity and verifies Firebase Bearer ID tokens on protected API endpoints via `AuthService.js` and `get_current_user` dependency.
- **Google Gemini AI API**: Generates personalized circuit plans, nutrition recommendations, and interactive AI Coach responses (`gemini-2.5-flash`).
- **Razorpay Payments**: Handles monthly SaaS subscription orders (`₹499/month`), HMAC SHA256 cryptographic signature verification, and webhook notifications.

---

## 3. Data Flow Architecture

### 3.1 Authentication & Profile Check Flow
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant React as React Frontend
    participant Firebase as Firebase Auth
    participant API as FastAPI Backend
    participant DB as Amazon RDS MySQL

    User->>React: Sign In / Complete Profile
    React->>Firebase: Authenticate User
    Firebase-->>React: Return ID Token (JWT)
    React->>API: POST /api/profile/check (Bearer Token)
    API->>Firebase: Verify Token Authenticity
    API->>DB: Query User Profile (UID)
    DB-->>API: Return User Record
    API-->>React: 200 OK (Profile Status & Metrics)
```

### 3.2 Live Workout Hysteresis & Biomechanics Flow
```mermaid
sequenceDiagram
    autonumber
    actor Athlete
    participant Cam as Webcam Feed
    participant Edge as MediaPipe Edge Model
    participant WS as FastAPI WebSocket
    participant Bio as Biomechanics Engine
    participant DB as Amazon RDS MySQL

    Athlete->>Cam: Perform Exercise (Squat / Pushup)
    Cam->>Edge: Capture Frame (30 FPS)
    Edge->>Edge: Calculate Joint Angles & Hysteresis State
    Edge->>WS: Stream Compressed Frame + Telemetry
    WS->>Bio: Run Biomechanics & XGBoost Rep Classifier
    Bio-->>WS: Return Verified Rep Count & Form Score
    WS-->>Athlete: Real-Time UI Visual Feedback
    Athlete->>WS: End Workout Session
    WS->>DB: Persist Session Record to MySQL
```

---

## 4. Target Production AWS Architecture

```mermaid
graph TD
    subgraph Internet & Clients
        U[Users / Web Browsers] -->|HTTPS :443| ALB[Application Load Balancer / Nginx]
    end

    subgraph AWS Cloud - Public Subnet
        ALB -->|Reverse Proxy :8000| EC2[EC2 Instance - FastAPI + Nginx]
    end

    subgraph AWS Cloud - Private Subnets
        EC2 -->|MySQL Protocol :3306| RDS[(Amazon RDS for MySQL)]
        EC2 -->|IAM Role / SSM| SSM[AWS Systems Manager]
        EC2 -->|Fetch Secrets| SEC[AWS Secrets Manager]
    end

    subgraph CI/CD & Artifacts
        GH[GitHub Actions Pipeline] -->|OIDC Auth| IAM[AWS IAM Role]
        GH -->|Upload Release Archive| S3[Amazon S3 Artifact Bucket]
        GH -->|Trigger RunCommand| SSM
        SSM -->|Deploy Artifact & Migrate| EC2
    end
```

---

## 5. Security & Compliance Controls

1. **Private Database Subnets**: Amazon RDS for MySQL is deployed strictly in private VPC subnets with no public IP address and security group ingress restricted to port 3306 from the EC2 application security group.
2. **Keyless CI/CD via OIDC**: GitHub Actions authenticates to AWS using short-lived OpenID Connect (OIDC) tokens (`aws-actions/configure-aws-credentials`), eliminating long-lived AWS IAM access keys.
3. **Secret Isolation**: Production database credentials, Razorpay secret keys, and Gemini API keys are retrieved securely from AWS Secrets Manager or EC2 environment variables — never exposed to client-side bundles or source code.
4. **Cryptographic Signature Verification**: Razorpay payment verification uses HMAC SHA256 signature comparison (`hmac.compare_digest`) on the server before granting Pro entitlements.
