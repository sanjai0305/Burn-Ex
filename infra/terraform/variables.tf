variable "aws_region" {
  type        = string
  default     = "ap-south-1"
  description = "AWS region for deployment"
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Target deployment environment (staging, production)"
}

variable "ec2_instance_type" {
  type        = string
  default     = "t3.medium"
  description = "AWS EC2 instance type"
}

variable "db_instance_class" {
  type        = string
  default     = "db.t4g.micro"
  description = "Amazon RDS MySQL instance class"
}

variable "mysql_version" {
  type        = string
  default     = "8.0"
  description = "MySQL engine version"
}

variable "db_name" {
  type        = string
  default     = "burnex_db"
  description = "Production MySQL Database Name"
}

variable "db_username" {
  type        = string
  default     = "burnex_user"
  description = "Production MySQL Database Username"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Production MySQL Database Master Password (must be passed securely via secret manager / environment variable)"
}

variable "github_repo" {
  type        = string
  default     = "org/burn-ex"
  description = "GitHub repository identifier in org/repo format"
}

variable "github_oidc_provider_arn" {
  type        = string
  default     = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
  description = "ARN of GitHub OIDC Provider in AWS IAM"
}
