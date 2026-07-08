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

output "api_gateway_url" {
  description = "Base URL for the HTTP API Gateway (set as NEXT_PUBLIC_API_URL in Vercel and mobile config)"
  value       = module.api_gateway.api_endpoint
}

output "recipe_images_bucket" {
  description = "S3 bucket name for recipe images"
  value       = aws_s3_bucket.recipe_images.bucket
}

output "recipe_images_cloudfront_domain" {
  description = "CloudFront domain for serving recipe images (use as NEXT_PUBLIC_IMAGES_CDN_DOMAIN)"
  value       = aws_cloudfront_distribution.recipe_images.domain_name
}
