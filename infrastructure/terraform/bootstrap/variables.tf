variable "aws_region" {
  description = "AWS region to create bootstrap resources in"
  type        = string
  default     = "eu-west-2"
}

variable "state_bucket_name" {
  description = "Name of the S3 bucket that stores Terraform state. Must be globally unique."
  type        = string
  default     = "souschef-terraform-state"
}

variable "lock_table_name" {
  description = "Name of the DynamoDB table used for Terraform state locking"
  type        = string
  default     = "souschef-terraform-locks"
}
