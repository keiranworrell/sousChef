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
# Built before terraform runs by the CI workflow (pnpm bundle:lambdas)

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
  # invoker permission added separately below to avoid circular dependency
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
