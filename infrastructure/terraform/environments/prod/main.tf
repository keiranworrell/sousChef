terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "souschef-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "eu-west-2"
    dynamodb_table = "souschef-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "souschef"
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}

# ── Cognito post-confirmation trigger ─────────────────────────────────────────

data "archive_file" "cognito_post_confirmation" {
  type        = "zip"
  source_file = "${path.root}/../../../../backend/dist/lambda/cognito-post-confirmation.js"
  output_path = "${path.root}/../../../../backend/dist/lambda/cognito-post-confirmation.zip"
}

module "cognito_post_confirmation" {
  source          = "../../modules/lambda"
  function_name   = "souschef-${var.environment}-cognito-post-confirmation"
  handler         = "cognito-post-confirmation.handler"
  zip_path        = data.archive_file.cognito_post_confirmation.output_path
  timeout_seconds = 30
  memory_mb       = 256

  environment_variables = {
    DATABASE_URL = var.database_url
    NODE_ENV     = var.environment
  }
}

resource "aws_cloudwatch_log_group" "cognito_post_confirmation" {
  name              = "/aws/lambda/${module.cognito_post_confirmation.function_name}"
  retention_in_days = 14
}

# Grant Cognito permission to invoke the Lambda
resource "aws_lambda_permission" "cognito_post_confirmation" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.cognito_post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = module.cognito.user_pool_arn
}

# ── Cognito User Pool ──────────────────────────────────────────────────────────

module "cognito" {
  source      = "../../modules/cognito"
  environment = var.environment

  web_callback_urls = [
    "https://souschef.app/auth/callback",
    "http://localhost:3000/auth/callback",
  ]

  web_logout_urls = [
    "https://souschef.app",
    "http://localhost:3000",
  ]

  mobile_callback_urls = ["souschef://auth/callback"]
  mobile_logout_urls   = ["souschef://"]

  post_confirmation_lambda_arn = module.cognito_post_confirmation.function_arn
}

# ── API Gateway ────────────────────────────────────────────────────────────────

module "api_gateway" {
  source      = "../../modules/api_gateway"
  api_name    = "souschef-${var.environment}-api"
  description = "sousChef HTTP API — ${var.environment}"

  cors_allow_origins = [
    "https://souschef.app",
    "http://localhost:3000",
  ]
}

# ── Recipes Lambda ─────────────────────────────────────────────────────────────

data "archive_file" "recipes" {
  type        = "zip"
  source_file = "${path.root}/../../../../backend/dist/lambda/recipes.js"
  output_path = "${path.root}/../../../../backend/dist/lambda/recipes.zip"
}

module "recipes" {
  source          = "../../modules/lambda"
  function_name   = "souschef-${var.environment}-recipes"
  handler         = "recipes.handler"
  zip_path        = data.archive_file.recipes.output_path
  timeout_seconds = 30
  memory_mb       = 256

  environment_variables = {
    DATABASE_URL         = var.database_url
    NODE_ENV             = var.environment
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_CLIENT_IDS   = "${module.cognito.web_client_id},${module.cognito.mobile_client_id}"
  }
}

resource "aws_cloudwatch_log_group" "recipes" {
  name              = "/aws/lambda/${module.recipes.function_name}"
  retention_in_days = 14
}

# Grant API Gateway permission to invoke the recipes Lambda
resource "aws_lambda_permission" "recipes_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.recipes.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.api_id}/*/recipes*"
}

# ── API Gateway integrations and routes ───────────────────────────────────────

resource "aws_apigatewayv2_integration" "recipes" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.recipes.function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "recipes_list" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /recipes"
  target    = "integrations/${aws_apigatewayv2_integration.recipes.id}"
}

resource "aws_apigatewayv2_route" "recipes_create" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /recipes"
  target    = "integrations/${aws_apigatewayv2_integration.recipes.id}"
}

resource "aws_apigatewayv2_route" "recipes_get" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /recipes/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.recipes.id}"
}

resource "aws_apigatewayv2_route" "recipes_update" {
  api_id    = module.api_gateway.api_id
  route_key = "PATCH /recipes/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.recipes.id}"
}

resource "aws_apigatewayv2_route" "recipes_delete" {
  api_id    = module.api_gateway.api_id
  route_key = "DELETE /recipes/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.recipes.id}"
}
