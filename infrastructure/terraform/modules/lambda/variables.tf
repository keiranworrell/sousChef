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
  # 1024, not 256. Lambda allocates CPU in proportion to memory — 256MB is
  # roughly a seventh of a vCPU, which has to boot the Node runtime, load the
  # bundle, initialise the AWS SDK and the Neon driver, and verify a JWT before
  # any of our code runs.
  #
  # This costs more, not less: these handlers spend most of their time waiting
  # on Neon, and waiting does not finish sooner with more CPU. Four times the
  # memory against roughly half the duration is about 2.2x the GB-seconds. It
  # is still free — Lambda's perpetual free tier is 400,000 GB-seconds a month
  # and a million requests would use around 249,000 of them.
  description = "Lambda memory allocation in MB. Also sets CPU share."
  type        = number
  default     = 1024
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
