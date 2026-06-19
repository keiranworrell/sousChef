variable "api_name" {
  description = "Name of the HTTP API Gateway"
  type        = string
}

variable "description" {
  description = "Description of the API Gateway"
  type        = string
  default     = ""
}

variable "cors_allow_origins" {
  description = "List of allowed CORS origins"
  type        = list(string)
  default     = ["*"]
}
