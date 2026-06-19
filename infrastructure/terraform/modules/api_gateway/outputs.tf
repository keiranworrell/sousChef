output "api_id" {
  description = "ID of the HTTP API Gateway"
  value       = aws_apigatewayv2_api.this.id
}

output "api_endpoint" {
  description = "The default invoke URL for the API (includes https://)"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "execution_arn" {
  description = "Execution ARN used for Lambda permission source_arn (arn:aws:execute-api:...)"
  value       = aws_apigatewayv2_api.this.execution_arn
}
