variable "aws_region" {
  description = "AWS region to deploy resources into"
  type        = string
  default     = "eu-west-2"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "prod"
}

variable "database_url" {
  description = "Neon Postgres connection string — injected via TF_VAR_database_url in CI, never committed"
  type        = string
  sensitive   = true
}
