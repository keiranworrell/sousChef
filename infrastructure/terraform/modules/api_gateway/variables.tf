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

variable "default_throttle_burst_limit" {
  description = "Default maximum concurrent requests across all routes"
  type        = number
  default     = 200
}

variable "default_throttle_rate_limit" {
  description = "Default sustained requests per second across all routes"
  type        = number
  default     = 100
}

variable "route_throttle_settings" {
  description = "Per-route throttle overrides. Key is the route key (e.g. \"POST /recipes/import/ai\"), value specifies burst and rate limits."
  type = map(object({
    burst_limit = number
    rate_limit  = number
  }))
  default = {}
}
