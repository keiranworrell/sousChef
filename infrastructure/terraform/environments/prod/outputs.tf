output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = module.cognito.user_pool_arn
}

output "cognito_user_pool_endpoint" {
  description = "Cognito User Pool endpoint"
  value       = module.cognito.user_pool_endpoint
}

output "cognito_web_client_id" {
  description = "Cognito App Client ID for the web app"
  value       = module.cognito.web_client_id
}

output "cognito_mobile_client_id" {
  description = "Cognito App Client ID for the mobile app"
  value       = module.cognito.mobile_client_id
}

output "cognito_hosted_ui_domain" {
  description = "Cognito hosted UI base URL"
  value       = module.cognito.hosted_ui_domain
}
