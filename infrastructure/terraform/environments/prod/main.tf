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
