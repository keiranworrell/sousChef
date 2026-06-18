variable "environment" {
  description = "Deployment environment name (e.g. prod, staging)"
  type        = string
}

variable "web_callback_urls" {
  description = "Allowed OAuth callback URLs for the web app client"
  type        = list(string)
  default     = ["http://localhost:3000/auth/callback"]
}

variable "web_logout_urls" {
  description = "Allowed logout URLs for the web app client"
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "mobile_callback_urls" {
  description = "Allowed OAuth callback URLs for the mobile app client"
  type        = list(string)
  default     = ["souschef://auth/callback"]
}

variable "mobile_logout_urls" {
  description = "Allowed logout URLs for the mobile app client"
  type        = list(string)
  default     = ["souschef://"]
}
