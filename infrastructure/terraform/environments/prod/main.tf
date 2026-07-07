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
    "https://sous-chef-web-l1zo.vercel.app",
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
  source_arn    = "${module.api_gateway.execution_arn}/*/recipes*"
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

resource "aws_apigatewayv2_route" "recipes_import" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /recipes/import"
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

# ── Pantry Lambda ──────────────────────────────────────────────────────────────

data "archive_file" "pantry" {
  type        = "zip"
  source_file = "${path.root}/../../../../backend/dist/lambda/pantry.js"
  output_path = "${path.root}/../../../../backend/dist/lambda/pantry.zip"
}

module "pantry" {
  source          = "../../modules/lambda"
  function_name   = "souschef-${var.environment}-pantry"
  handler         = "pantry.handler"
  zip_path        = data.archive_file.pantry.output_path
  timeout_seconds = 30
  memory_mb       = 256

  environment_variables = {
    DATABASE_URL         = var.database_url
    NODE_ENV             = var.environment
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_CLIENT_IDS   = "${module.cognito.web_client_id},${module.cognito.mobile_client_id}"
  }
}

resource "aws_cloudwatch_log_group" "pantry" {
  name              = "/aws/lambda/${module.pantry.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_permission" "pantry_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.pantry.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/pantry*"
}

resource "aws_apigatewayv2_integration" "pantry" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.pantry.function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "pantry_list" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /pantry"
  target    = "integrations/${aws_apigatewayv2_integration.pantry.id}"
}

resource "aws_apigatewayv2_route" "pantry_create" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /pantry"
  target    = "integrations/${aws_apigatewayv2_integration.pantry.id}"
}

resource "aws_apigatewayv2_route" "pantry_update" {
  api_id    = module.api_gateway.api_id
  route_key = "PATCH /pantry/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.pantry.id}"
}

resource "aws_apigatewayv2_route" "pantry_delete" {
  api_id    = module.api_gateway.api_id
  route_key = "DELETE /pantry/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.pantry.id}"
}

# ── Shopping Lambda ────────────────────────────────────────────────────────────

data "archive_file" "shopping" {
  type        = "zip"
  source_file = "${path.root}/../../../../backend/dist/lambda/shopping.js"
  output_path = "${path.root}/../../../../backend/dist/lambda/shopping.zip"
}

module "shopping" {
  source          = "../../modules/lambda"
  function_name   = "souschef-${var.environment}-shopping"
  handler         = "shopping.handler"
  zip_path        = data.archive_file.shopping.output_path
  timeout_seconds = 30
  memory_mb       = 256

  environment_variables = {
    DATABASE_URL         = var.database_url
    NODE_ENV             = var.environment
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_CLIENT_IDS   = "${module.cognito.web_client_id},${module.cognito.mobile_client_id}"
  }
}

resource "aws_cloudwatch_log_group" "shopping" {
  name              = "/aws/lambda/${module.shopping.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_permission" "shopping_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.shopping.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/shopping*"
}

resource "aws_apigatewayv2_integration" "shopping" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.shopping.function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "shopping_list" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /shopping"
  target    = "integrations/${aws_apigatewayv2_integration.shopping.id}"
}

resource "aws_apigatewayv2_route" "shopping_create" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /shopping"
  target    = "integrations/${aws_apigatewayv2_integration.shopping.id}"
}

resource "aws_apigatewayv2_route" "shopping_get" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /shopping/{listId}"
  target    = "integrations/${aws_apigatewayv2_integration.shopping.id}"
}

resource "aws_apigatewayv2_route" "shopping_update" {
  api_id    = module.api_gateway.api_id
  route_key = "PATCH /shopping/{listId}"
  target    = "integrations/${aws_apigatewayv2_integration.shopping.id}"
}

resource "aws_apigatewayv2_route" "shopping_delete" {
  api_id    = module.api_gateway.api_id
  route_key = "DELETE /shopping/{listId}"
  target    = "integrations/${aws_apigatewayv2_integration.shopping.id}"
}

resource "aws_apigatewayv2_route" "shopping_items_create" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /shopping/{listId}/items"
  target    = "integrations/${aws_apigatewayv2_integration.shopping.id}"
}

resource "aws_apigatewayv2_route" "shopping_items_update" {
  api_id    = module.api_gateway.api_id
  route_key = "PATCH /shopping/{listId}/items/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.shopping.id}"
}

resource "aws_apigatewayv2_route" "shopping_items_delete" {
  api_id    = module.api_gateway.api_id
  route_key = "DELETE /shopping/{listId}/items/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.shopping.id}"
}

resource "aws_apigatewayv2_route" "shopping_complete" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /shopping/{listId}/complete"
  target    = "integrations/${aws_apigatewayv2_integration.shopping.id}"
}

resource "aws_apigatewayv2_route" "shopping_items_bulk_add" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /shopping/{listId}/items/bulk"
  target    = "integrations/${aws_apigatewayv2_integration.shopping.id}"
}

# ── Meal Plans Lambda ──────────────────────────────────────────────────────────

data "archive_file" "mealplans" {
  type        = "zip"
  source_file = "${path.root}/../../../../backend/dist/lambda/mealplans.js"
  output_path = "${path.root}/../../../../backend/dist/lambda/mealplans.zip"
}

module "mealplans" {
  source          = "../../modules/lambda"
  function_name   = "souschef-${var.environment}-mealplans"
  handler         = "mealplans.handler"
  zip_path        = data.archive_file.mealplans.output_path
  timeout_seconds = 30
  memory_mb       = 256

  environment_variables = {
    DATABASE_URL         = var.database_url
    NODE_ENV             = var.environment
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_CLIENT_IDS   = "${module.cognito.web_client_id},${module.cognito.mobile_client_id}"
  }
}

resource "aws_cloudwatch_log_group" "mealplans" {
  name              = "/aws/lambda/${module.mealplans.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_permission" "mealplans_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.mealplans.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/meal-plans*"
}

resource "aws_apigatewayv2_integration" "mealplans" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.mealplans.function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "mealplans_get" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /meal-plans"
  target    = "integrations/${aws_apigatewayv2_integration.mealplans.id}"
}

resource "aws_apigatewayv2_route" "mealplans_entries_create" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /meal-plans/{planId}/entries"
  target    = "integrations/${aws_apigatewayv2_integration.mealplans.id}"
}

resource "aws_apigatewayv2_route" "mealplans_entries_delete" {
  api_id    = module.api_gateway.api_id
  route_key = "DELETE /meal-plans/{planId}/entries/{entryId}"
  target    = "integrations/${aws_apigatewayv2_integration.mealplans.id}"
}

resource "aws_apigatewayv2_route" "mealplans_generate_shopping_list" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /meal-plans/{planId}/shopping-list"
  target    = "integrations/${aws_apigatewayv2_integration.mealplans.id}"
}

# ── Fermentation Lambda ────────────────────────────────────────────────────────

data "archive_file" "fermentation" {
  type        = "zip"
  source_file = "${path.root}/../../../../backend/dist/lambda/fermentation.js"
  output_path = "${path.root}/../../../../backend/dist/lambda/fermentation.zip"
}

module "fermentation" {
  source          = "../../modules/lambda"
  function_name   = "souschef-${var.environment}-fermentation"
  handler         = "fermentation.handler"
  zip_path        = data.archive_file.fermentation.output_path
  timeout_seconds = 30
  memory_mb       = 256

  environment_variables = {
    DATABASE_URL         = var.database_url
    NODE_ENV             = var.environment
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_CLIENT_IDS   = "${module.cognito.web_client_id},${module.cognito.mobile_client_id}"
  }
}

resource "aws_cloudwatch_log_group" "fermentation" {
  name              = "/aws/lambda/${module.fermentation.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_permission" "fermentation_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.fermentation.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/fermentation*"
}

resource "aws_apigatewayv2_integration" "fermentation" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.fermentation.function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "fermentation_list" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /fermentation"
  target    = "integrations/${aws_apigatewayv2_integration.fermentation.id}"
}

resource "aws_apigatewayv2_route" "fermentation_create" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /fermentation"
  target    = "integrations/${aws_apigatewayv2_integration.fermentation.id}"
}

resource "aws_apigatewayv2_route" "fermentation_get" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /fermentation/{batchId}"
  target    = "integrations/${aws_apigatewayv2_integration.fermentation.id}"
}

resource "aws_apigatewayv2_route" "fermentation_update" {
  api_id    = module.api_gateway.api_id
  route_key = "PATCH /fermentation/{batchId}"
  target    = "integrations/${aws_apigatewayv2_integration.fermentation.id}"
}

resource "aws_apigatewayv2_route" "fermentation_delete" {
  api_id    = module.api_gateway.api_id
  route_key = "DELETE /fermentation/{batchId}"
  target    = "integrations/${aws_apigatewayv2_integration.fermentation.id}"
}

resource "aws_apigatewayv2_route" "fermentation_logs_create" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /fermentation/{batchId}/logs"
  target    = "integrations/${aws_apigatewayv2_integration.fermentation.id}"
}

resource "aws_apigatewayv2_route" "fermentation_logs_update" {
  api_id    = module.api_gateway.api_id
  route_key = "PATCH /fermentation/{batchId}/logs/{logId}"
  target    = "integrations/${aws_apigatewayv2_integration.fermentation.id}"
}

resource "aws_apigatewayv2_route" "fermentation_logs_delete" {
  api_id    = module.api_gateway.api_id
  route_key = "DELETE /fermentation/{batchId}/logs/{logId}"
  target    = "integrations/${aws_apigatewayv2_integration.fermentation.id}"
}

# ── Community Lambda ───────────────────────────────────────────────────────────

data "archive_file" "community" {
  type        = "zip"
  source_file = "${path.root}/../../../../backend/dist/lambda/community.js"
  output_path = "${path.root}/../../../../backend/dist/lambda/community.zip"
}

module "community" {
  source          = "../../modules/lambda"
  function_name   = "souschef-${var.environment}-community"
  handler         = "community.handler"
  zip_path        = data.archive_file.community.output_path
  timeout_seconds = 30
  memory_mb       = 256

  environment_variables = {
    DATABASE_URL         = var.database_url
    NODE_ENV             = var.environment
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_CLIENT_IDS   = "${module.cognito.web_client_id},${module.cognito.mobile_client_id}"
  }
}

resource "aws_cloudwatch_log_group" "community" {
  name              = "/aws/lambda/${module.community.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_permission" "community_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.community.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/community*"
}

resource "aws_apigatewayv2_integration" "community" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.community.function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "community_list" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /community/recipes"
  target    = "integrations/${aws_apigatewayv2_integration.community.id}"
}

resource "aws_apigatewayv2_route" "community_get" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /community/recipes/{recipeId}"
  target    = "integrations/${aws_apigatewayv2_integration.community.id}"
}

resource "aws_apigatewayv2_route" "community_fork" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /community/recipes/{recipeId}/fork"
  target    = "integrations/${aws_apigatewayv2_integration.community.id}"
}
