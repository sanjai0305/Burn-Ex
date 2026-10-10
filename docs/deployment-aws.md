# Burn-Ex — AWS EC2 & RDS MySQL Deployment Guide

This guide provides step-by-step instructions for deploying the **Burn-Ex** platform to AWS using **Amazon EC2**, **Amazon RDS for MySQL**, **Nginx**, **AWS Systems Manager (SSM)**, and **GitHub Actions OIDC**.

---

## 1. Target AWS Infrastructure Overview

```text
GitHub Actions (OIDC) ──> S3 Artifact Bucket (Release Archive)
                              │
                              ▼
AWS SSM RunCommand ─────> AWS EC2 Instance
                              ├── Nginx (Port 80/443) ──> React SPA (/dist)
                              └── Systemd (Port 8000) ──> FastAPI (Uvicorn)
                                                              │
                                                              ▼ (Private Subnet :3306)
                                                      Amazon RDS for MySQL
```

### Key Components
- **Application Server**: Amazon EC2 running Ubuntu 22.04 LTS.
- **Database Server**: Amazon RDS for MySQL in private VPC subnets (Encrypted, Automated Backups).
- **Web Server & Reverse Proxy**: Nginx serving built static assets and proxying `/api` and `/ws` WebSockets to FastAPI on `127.0.0.1:8000`.
- **Process Manager**: Systemd managing `burnex-backend.service`.
- **CI/CD Pipeline**: GitHub Actions keyless OIDC authentication to AWS.
- **Deployment Transport**: AWS Systems Manager (SSM) Session Manager RunCommand (No open SSH ports required).

---

## 2. Infrastructure Provisioning via Terraform

### 2.1 Navigate to Infrastructure Directory
```bash
cd infra/terraform
```

### 2.2 Configure Infrastructure Variables
Copy `terraform.tfvars.example` to `terraform.tfvars`:
```bash
cp terraform.tfvars.example terraform.tfvars
```
Update `terraform.tfvars` with your AWS configuration:
```hcl
aws_region               = "ap-south-1"
environment              = "production"
ec2_instance_type        = "t3.medium"
db_instance_class        = "db.t4g.micro"
mysql_version            = "8.0"
db_name                  = "burnex_db"
db_username              = "burnex_user"
db_password              = "SECURE_RDS_PASSWORD_HERE"
github_repo              = "your-username/burn-ex"
github_oidc_provider_arn = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
```

### 2.3 Initialize and Provision Infrastructure
```bash
terraform init
terraform plan
# Review the plan, then apply:
terraform apply
```

---

## 3. Server Setup (EC2 Initial Configuration)

Log into your EC2 instance via AWS Systems Manager Session Manager:
```bash
aws ssm start-session --target <EC2_INSTANCE_ID>
```

### 3.1 Install Prerequisites & Directory Structure
```bash
sudo apt-get update && sudo apt-get install -y \
    python3 \
    python3-venv \
    python3-pip \
    nginx \
    curl \
    git \
    awscli

sudo mkdir -p /var/www/burnex/releases
sudo mkdir -p /var/www/burnex/shared
sudo chown -R ubuntu:ubuntu /var/www/burnex
```

### 3.2 Configure Production Environment Variables
Create the shared production `.env` file at `/var/www/burnex/shared/.env`:
```env
# Production MySQL RDS Connection URL
MYSQL_URL=mysql+pymysql://burnex_user:SECURE_RDS_PASSWORD_HERE@burnex-db-production.xxxxxx.ap-south-1.rds.amazonaws.com:3306/burnex_db

# Firebase Authentication (Project ID)
FIREBASE_PROJECT_ID=burn-x-7200b

# Google Gemini API Settings
GEMINI_API_KEY=YOUR_PRODUCTION_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash

# Razorpay Payments Configuration
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxx
```
Ensure permissions are restricted:
```bash
chmod 600 /var/www/burnex/shared/.env
```

### 3.3 Configure Systemd & Nginx
Copy service and Nginx configurations from the repository:
```bash
# Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/burnex
sudo ln -sf /etc/nginx/sites-available/burnex /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Systemd Service
sudo cp deploy/burnex-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable burnex-backend
```

---

## 4. GitHub Actions CI/CD Configuration

### 4.1 GitHub Repository Secrets & Variables

Navigate to **GitHub Repository Settings > Secrets and variables > Actions**:

#### Repository Secrets (`Secrets`)
- `AWS_ROLE_ARN`: IAM OIDC Role ARN outputted by Terraform (`github_actions_role_arn`).

#### Repository Variables (`Variables`)
- `AWS_REGION`: `ap-south-1` (or your target region).
- `DEPLOY_BUCKET`: `burnex-deployment-artifacts-ap-south-1-production` (from Terraform outputs).
- `EC2_INSTANCE_ID`: `i-0xxxxxxxxxxxxxxxxx` (from Terraform outputs).

---

## 5. Deployment Flow & Rollback Procedures

### 5.1 Deployment Flow
1. Code pushed to `main` branch triggers `.github/workflows/deploy.yml`.
2. CI checks run (`npm run build`, `unittest`).
3. Bundle `burnex-release-<SHA>.tar.gz` is built and uploaded to S3.
4. AWS SSM sends RunCommand to EC2 to execute `/var/www/burnex/current/deploy/deploy.sh`.
5. `deploy.sh` unpacks release, links shared `.env`, installs backend dependencies, updates `current` symlink, restarts `burnex-backend` systemd service, reloads Nginx, and verifies `http://127.0.0.1:8000/health`.

### 5.2 Manual Rollback Procedure
To roll back to a previous release on EC2:
```bash
cd /var/www/burnex/releases
# List available releases:
ls -dt */

# Point current symlink to previous release:
ln -sfn /var/www/burnex/releases/20261010_PREVIOUS_TAG /var/www/burnex/current

# Restart Services:
sudo systemctl restart burnex-backend
sudo systemctl reload nginx

# Verify Health:
curl -i http://127.0.0.1:8000/health
```

---

## 6. Security Checklist
- [x] Amazon RDS for MySQL has **Publicly Accessible = False**.
- [x] Security Group for RDS allows ingress port 3306 **only from EC2 Security Group**.
- [x] GitHub Actions authenticates via **IAM OIDC Role (Keyless)**.
- [x] EC2 instance uses **SSM Session Manager (No SSH port 22 exposed to 0.0.0.0/0)**.
- [x] Production secrets stored exclusively in `/var/www/burnex/shared/.env`.
