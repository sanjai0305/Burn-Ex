# ==============================================================================
# Burn-Ex — Terraform AWS Infrastructure Configuration
# Amazon EC2, RDS for MySQL, S3 Artifact Bucket, IAM OIDC & SSM Integration
# ==============================================================================

terraform {
  required_version = ">= 1.3.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "Burn-Ex"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ------------------------------------------------------------------------------
# 1. Network / Security Groups
# ------------------------------------------------------------------------------
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Security Group for EC2 Application Server
resource "aws_security_group" "ec2_sg" {
  name        = "burnex-ec2-sg-${var.environment}"
  description = "Security group for Burn-Ex EC2 Application Server"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Allow HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Security Group for Amazon RDS MySQL (Restricted to EC2 SG)
resource "aws_security_group" "rds_sg" {
  name        = "burnex-rds-sg-${var.environment}"
  description = "Security group for Burn-Ex RDS MySQL Database Instance"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "Allow MySQL access strictly from EC2 Application SG"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2_sg.id]
  }

  egress {
    description = "Allow outbound response traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# DB Subnet Group
resource "aws_db_subnet_group" "burnex_db_subnets" {
  name       = "burnex-db-subnet-group-${var.environment}"
  subnet_ids = data.aws_subnets.default.ids
}

# ------------------------------------------------------------------------------
# 2. Amazon RDS for MySQL Database Instance
# ------------------------------------------------------------------------------
resource "aws_db_instance" "burnex_mysql" {
  identifier             = "burnex-db-${var.environment}"
  engine                 = "mysql"
  engine_version         = var.mysql_version
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  max_allocated_storage  = 100
  storage_type           = "gp3"
  storage_encrypted      = true

  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  port                   = 3306

  db_subnet_group_name   = aws_db_subnet_group.burnex_db_subnets.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  publicly_accessible    = false
  skip_final_snapshot    = true
  deletion_protection    = var.environment == "production" ? true : false

  backup_retention_period = 7
  maintenance_window      = "Sun:03:00-Sun:04:00"
}

# ------------------------------------------------------------------------------
# 3. Amazon S3 Bucket for Versioned Deployment Artifacts
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "deployment_artifacts" {
  bucket        = "burnex-deployment-artifacts-${var.aws_region}-${var.environment}"
  force_destroy = var.environment == "production" ? false : true
}

resource "aws_s3_bucket_versioning" "artifacts_versioning" {
  bucket = aws_s3_bucket.deployment_artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

# ------------------------------------------------------------------------------
# 4. IAM Roles for SSM Session Manager & GitHub Actions OIDC
# ------------------------------------------------------------------------------

# EC2 Instance Profile for SSM Session Manager & S3 Artifact Access
resource "aws_iam_role" "ec2_ssm_role" {
  name = "burnex-ec2-ssm-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_managed_policy" {
  role       = aws_iam_role.ec2_ssm_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "s3_download_policy" {
  name = "burnex-s3-download-policy"
  role = aws_iam_role.ec2_ssm_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.deployment_artifacts.arn,
          "${aws_s3_bucket.deployment_artifacts.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2_instance_profile" {
  name = "burnex-ec2-instance-profile-${var.environment}"
  role = aws_iam_role.ec2_ssm_role.name
}

# GitHub Actions OIDC Role
resource "aws_iam_role" "github_actions_oidc" {
  name = "burnex-github-actions-deploy-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = var.github_oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:*"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "github_actions_policy" {
  name = "burnex-github-actions-policy"
  role = aws_iam_role.github_actions_oidc.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.deployment_artifacts.arn,
          "${aws_s3_bucket.deployment_artifacts.arn}/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:SendCommand", "ssm:GetCommandInvocation", "ssm:ListCommands"]
        Resource = "*"
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 5. Amazon EC2 Application Server
# ------------------------------------------------------------------------------
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical Ubuntu

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_instance" "app_server" {
  ami                  = data.aws_ami.ubuntu.id
  instance_type        = var.ec2_instance_type
  iam_instance_profile = aws_iam_instance_profile.ec2_instance_profile.name
  vpc_security_group_ids = [aws_security_group.ec2_sg.id]
  subnet_id            = data.aws_subnets.default.ids[0]

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
    encrypted   = true
  }

  tags = {
    Name = "burnex-app-server-${var.environment}"
  }
}
