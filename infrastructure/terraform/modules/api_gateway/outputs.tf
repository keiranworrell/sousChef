output "api_id" {
  description = "ID of the HTTP API Gateway"
  value       = aws_apigatewayv2_api.this.id
}

output "api_endpoint" {
  description = "The default invoke URL for the API (includes https://)"
  value       = aws_apigatewayv2_stage.default.invoke_url
}
