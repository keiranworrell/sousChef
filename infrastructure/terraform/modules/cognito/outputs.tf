output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.this.arn
}

output "user_pool_endpoint" {
  description = "Cognito User Pool endpoint (used for JWT issuer validation)"
  value       = aws_cognito_user_pool.this.endpoint
}

output "web_client_id" {
  description = "Cognito App Client ID for the web app"
  value       = aws_cognito_user_pool_client.web.id
}

output "mobile_client_id" {
  description = "Cognito App Client ID for the mobile app"
  value       = aws_cognito_user_pool_client.mobile.id
}

output "hosted_ui_domain" {
  description = "Cognito hosted UI base URL"
  value       = "https://${aws_cognito_user_pool_domain.this.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
}
