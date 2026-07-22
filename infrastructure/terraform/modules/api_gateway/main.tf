resource "aws_apigatewayv2_api" "this" {
  name          = var.api_name
  protocol_type = "HTTP"
  description   = var.description

  cors_configuration {
    allow_headers = ["content-type", "authorization"]
    allow_methods = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    allow_origins = var.cors_allow_origins
    max_age       = 300
  }

  tags = {
    Name = var.api_name
  }
}

resource "aws_cloudwatch_log_group" "access_logs" {
  name              = "/aws/apigateway/${var.api_name}"
  retention_in_days = 14
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.access_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
    })
  }

  # Global throttle — applies to all routes unless overridden below
  default_route_settings {
    throttling_burst_limit = var.default_throttle_burst_limit
    throttling_rate_limit  = var.default_throttle_rate_limit
  }

  # Per-route overrides (e.g. tighter limits on AI endpoints)
  dynamic "route_settings" {
    for_each = var.route_throttle_settings
    content {
      route_key              = route_settings.key
      throttling_burst_limit = route_settings.value.burst_limit
      throttling_rate_limit  = route_settings.value.rate_limit
    }
  }

  tags = {
    Name = "${var.api_name}-default-stage"
  }
}
