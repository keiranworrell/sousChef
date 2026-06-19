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
}

# ── Cognito post-confirmation trigger ─────────────────────────────────────────

# Zip the pre-bundled JS file. The bundle must be built before terraform apply:
#   cd backend && pnpm bundle:lambdas
data "archive_file" "cognito_post_confirmation" {
  type        = "zip"
  source_file = "${path.root}/../../../../backend/dist/lambda/cognito-post-confirmation.js"
  output_path = "${path.root}/../../../../backend/dist/lambda/cognito-post-confirmation.zip"
}

module "cognito_post_confirmation" {
  source        = "../../modules/lambda"
  function_name = "souschef-${var.environment}-cognito-post-confirmation"
  handler       = "cognito-post-confirmation.handler"
  zip_path      = data.archive_file.cognito_post_confirmation.output_path
  timeout_seconds = 30
  memory_mb       = 256

  environment_variables = {
    DATABASE_URL = var.database_url
    NODE_ENV     = var.environment
  }

  invoker_principal  = "cognito-idp.amazonaws.com"
  invoker_source_arn = module.cognito.user_pool_arn
}

# Wire the Lambda trigger into the Cognito User Pool
resource "aws_cognito_user_pool_lambda_config" "this" {
  user_pool_id        = module.cognito.user_pool_id
  post_confirmation   = module.cognito_post_confirmation.function_arn
}
