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

# ── Secrets Manager ────────────────────────────────────────────────────────────

# Reference the manually-created secret — value is never stored in Terraform state
data "aws_secretsmanager_secret" "database_url" {
  name = "souschef-prod-database-url"
}

locals {
  # IAM policy granting GetSecretValue on the DB secret — applied to all Lambdas
  db_secret_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = data.aws_secretsmanager_secret.database_url.arn
      }
    ]
  })

  # Images Lambda needs both S3 write and Secrets Manager access
  images_combined_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = [
          "arn:aws:s3:::souschef-${var.environment}-recipe-images/recipes/*",
          "arn:aws:s3:::souschef-${var.environment}-recipe-images/avatars/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = data.aws_secretsmanager_secret.database_url.arn
      }
    ]
  })
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
  policy_json     = local.db_secret_policy

  environment_variables = {
    DATABASE_SECRET_ARN = data.aws_secretsmanager_secret.database_url.arn
    NODE_ENV            = var.environment
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
  policy_json     = local.db_secret_policy

  environment_variables = {
    DATABASE_SECRET_ARN  = data.aws_secretsmanager_secret.database_url.arn
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

resource "aws_apigatewayv2_route" "recipes_import_parse" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /recipes/import/parse"
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

resource "aws_apigatewayv2_route" "recipes_log_cook" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /recipes/{id}/cook"
  target    = "integrations/${aws_apigatewayv2_integration.recipes.id}"
}

resource "aws_apigatewayv2_route" "recipes_cook_history" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /recipes/cook-history"
  target    = "integrations/${aws_apigatewayv2_integration.recipes.id}"
}

resource "aws_apigatewayv2_route" "recipes_rediscover" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /recipes/rediscover"
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
  policy_json     = local.db_secret_policy

  environment_variables = {
    DATABASE_SECRET_ARN  = data.aws_secretsmanager_secret.database_url.arn
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
  policy_json     = local.db_secret_policy

  environment_variables = {
    DATABASE_SECRET_ARN  = data.aws_secretsmanager_secret.database_url.arn
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
  policy_json     = local.db_secret_policy

  environment_variables = {
    DATABASE_SECRET_ARN  = data.aws_secretsmanager_secret.database_url.arn
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
  policy_json     = local.db_secret_policy

  environment_variables = {
    DATABASE_SECRET_ARN  = data.aws_secretsmanager_secret.database_url.arn
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
  policy_json     = local.db_secret_policy

  environment_variables = {
    DATABASE_SECRET_ARN  = data.aws_secretsmanager_secret.database_url.arn
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

resource "aws_lambda_permission" "public_api" {
  statement_id  = "AllowAPIGatewayInvokePublic"
  action        = "lambda:InvokeFunction"
  function_name = module.community.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/public*"
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

resource "aws_apigatewayv2_route" "public_recipe_get" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /public/recipes/{recipeId}"
  target    = "integrations/${aws_apigatewayv2_integration.community.id}"
}

# ── Recipe Images S3 + CloudFront ──────────────────────────────────────────────

resource "aws_s3_bucket" "recipe_images" {
  bucket = "souschef-${var.environment}-recipe-images"

  tags = {
    Name = "souschef-${var.environment}-recipe-images"
  }
}

resource "aws_s3_bucket_public_access_block" "recipe_images" {
  bucket                  = aws_s3_bucket.recipe_images.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "recipe_images" {
  bucket = aws_s3_bucket.recipe_images.id

  cors_rule {
    allowed_headers = ["Content-Type"]
    allowed_methods = ["PUT"]
    allowed_origins = [
      "https://souschef.app",
      "https://sous-chef-web-l1zo.vercel.app",
      "http://localhost:3000",
    ]
    max_age_seconds = 3000
  }
}

resource "aws_cloudfront_origin_access_control" "recipe_images" {
  name                              = "souschef-${var.environment}-recipe-images-oac"
  description                       = "OAC for sousChef recipe images bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "recipe_images" {
  enabled             = true
  comment             = "sousChef ${var.environment} recipe images CDN"
  default_root_object = ""
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.recipe_images.bucket_regional_domain_name
    origin_id                = "s3-recipe-images"
    origin_access_control_id = aws_cloudfront_origin_access_control.recipe_images.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-recipe-images"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "souschef-${var.environment}-recipe-images"
  }
}

# Allow CloudFront to read from the S3 bucket via OAC
resource "aws_s3_bucket_policy" "recipe_images" {
  bucket = aws_s3_bucket.recipe_images.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.recipe_images.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.recipe_images.arn
          }
        }
      }
    ]
  })
}

# ── Images Lambda ──────────────────────────────────────────────────────────────

data "archive_file" "images" {
  type        = "zip"
  source_file = "${path.root}/../../../../backend/dist/lambda/images.js"
  output_path = "${path.root}/../../../../backend/dist/lambda/images.zip"
}


module "images" {
  source          = "../../modules/lambda"
  function_name   = "souschef-${var.environment}-images"
  handler         = "images.handler"
  zip_path        = data.archive_file.images.output_path
  timeout_seconds = 30
  memory_mb       = 256
  policy_json     = local.images_combined_policy

  environment_variables = {
    DATABASE_SECRET_ARN      = data.aws_secretsmanager_secret.database_url.arn
    NODE_ENV                 = var.environment
    COGNITO_USER_POOL_ID     = module.cognito.user_pool_id
    COGNITO_CLIENT_IDS       = "${module.cognito.web_client_id},${module.cognito.mobile_client_id}"
    IMAGES_BUCKET_NAME       = aws_s3_bucket.recipe_images.bucket
    IMAGES_CLOUDFRONT_DOMAIN = aws_cloudfront_distribution.recipe_images.domain_name
  }
}

resource "aws_cloudwatch_log_group" "images" {
  name              = "/aws/lambda/${module.images.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_permission" "images_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.images.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/images*"
}

resource "aws_apigatewayv2_integration" "images" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.images.function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "images_presign" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /images/presign"
  target    = "integrations/${aws_apigatewayv2_integration.images.id}"
}

# ── Users Lambda ───────────────────────────────────────────────────────────────

data "archive_file" "users" {
  type        = "zip"
  source_file = "${path.root}/../../../../backend/dist/lambda/users.js"
  output_path = "${path.root}/../../../../backend/dist/lambda/users.zip"
}

module "users" {
  source          = "../../modules/lambda"
  function_name   = "souschef-${var.environment}-users"
  handler         = "users.handler"
  zip_path        = data.archive_file.users.output_path
  timeout_seconds = 30
  memory_mb       = 256
  policy_json     = local.db_secret_policy

  environment_variables = {
    DATABASE_SECRET_ARN  = data.aws_secretsmanager_secret.database_url.arn
    NODE_ENV             = var.environment
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_CLIENT_IDS   = "${module.cognito.web_client_id},${module.cognito.mobile_client_id}"
  }
}

resource "aws_cloudwatch_log_group" "users" {
  name              = "/aws/lambda/${module.users.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_permission" "users_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.users.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/users*"
}

resource "aws_apigatewayv2_integration" "users" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.users.function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "users_me_get" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /users/me"
  target    = "integrations/${aws_apigatewayv2_integration.users.id}"
}

resource "aws_apigatewayv2_route" "users_me_update" {
  api_id    = module.api_gateway.api_id
  route_key = "PATCH /users/me"
  target    = "integrations/${aws_apigatewayv2_integration.users.id}"
}

resource "aws_apigatewayv2_route" "users_profile_get" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /users/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.users.id}"
}

resource "aws_apigatewayv2_route" "users_follow" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /users/{id}/follow"
  target    = "integrations/${aws_apigatewayv2_integration.users.id}"
}

resource "aws_apigatewayv2_route" "users_unfollow" {
  api_id    = module.api_gateway.api_id
  route_key = "DELETE /users/{id}/follow"
  target    = "integrations/${aws_apigatewayv2_integration.users.id}"
}

# ── Feed Lambda ────────────────────────────────────────────────────────────────

data "archive_file" "feed" {
  type        = "zip"
  source_file = "${path.root}/../../../../backend/dist/lambda/feed.js"
  output_path = "${path.root}/../../../../backend/dist/lambda/feed.zip"
}

module "feed" {
  source          = "../../modules/lambda"
  function_name   = "souschef-${var.environment}-feed"
  handler         = "feed.handler"
  zip_path        = data.archive_file.feed.output_path
  timeout_seconds = 30
  memory_mb       = 256
  policy_json     = local.db_secret_policy

  environment_variables = {
    DATABASE_SECRET_ARN  = data.aws_secretsmanager_secret.database_url.arn
    NODE_ENV             = var.environment
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_CLIENT_IDS   = "${module.cognito.web_client_id},${module.cognito.mobile_client_id}"
  }
}

resource "aws_cloudwatch_log_group" "feed" {
  name              = "/aws/lambda/${module.feed.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_permission" "feed_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.feed.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/feed*"
}

resource "aws_apigatewayv2_integration" "feed" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.feed.function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "feed_list" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /feed"
  target    = "integrations/${aws_apigatewayv2_integration.feed.id}"
}
