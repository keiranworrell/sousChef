variable "function_name" {
  description = "Name of the Lambda function"
  type        = string
}

variable "handler" {
  description = "Handler entrypoint in the form file.exportedFunction"
  type        = string
}

variable "zip_path" {
  description = "Path to the deployment ZIP file"
  type        = string
}

variable "timeout_seconds" {
  description = "Lambda execution timeout in seconds"
  type        = number
  default     = 30
}

variable "memory_mb" {
  description = "Lambda memory allocation in MB"
  type        = number
  default     = 256
}

variable "environment_variables" {
  description = "Environment variables to set on the Lambda function"
  type        = map(string)
  default     = {}
}

variable "policy_json" {
  description = "Optional IAM policy JSON to attach to the Lambda execution role"
  type        = string
  default     = null
}

variable "invoker_principal" {
  description = "AWS service principal allowed to invoke this Lambda (e.g. cognito-idp.amazonaws.com)"
  type        = string
  default     = null
}

variable "invoker_source_arn" {
  description = "ARN of the resource allowed to invoke this Lambda (required when invoker_principal is set)"
  type        = string
  default     = null
}
