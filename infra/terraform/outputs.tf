output "ec2_public_ip" {
  value       = aws_instance.app_server.public_ip
  description = "Public IP address of the Burn-Ex EC2 Application Server"
}

output "ec2_instance_id" {
  value       = aws_instance.app_server.id
  description = "Instance ID of the Burn-Ex EC2 Application Server"
}

output "rds_endpoint" {
  value       = aws_db_instance.burnex_mysql.endpoint
  description = "Private Endpoint URL for Amazon RDS MySQL"
}

output "s3_artifact_bucket" {
  value       = aws_s3_bucket.deployment_artifacts.bucket
  description = "Name of the S3 Bucket storing versioned deployment archives"
}

output "github_actions_role_arn" {
  value       = aws_iam_role.github_actions_oidc.arn
  description = "IAM Role ARN to configure in GitHub Actions OIDC workflow"
}
