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
