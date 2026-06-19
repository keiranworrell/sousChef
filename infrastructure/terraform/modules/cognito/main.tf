data "aws_region" "current" {}

resource "aws_cognito_user_pool" "this" {
  name = "souschef-${var.environment}"

  # Users sign in with their email address
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Prevent leaking whether an account exists on sign-in failure
  username_configuration {
    case_sensitive = false
  }

  password_policy {
    minimum_length                   = 8
    require_uppercase                = true
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  # Email verification
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your sousChef verification code"
    email_message        = "Your sousChef verification code is {####}"
  }

  # Use Cognito's built-in email sender (up to 50/day — sufficient for early prod)
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Account recovery via email only
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # User profile attributes
  schema {
    name                     = "email"
    attribute_data_type      = "String"
    required                 = true
    mutable                  = true

    string_attribute_constraints {
      min_length = 5
      max_length = 254
    }
  }

  schema {
    name                     = "name"
    attribute_data_type      = "String"
    required                 = true
    mutable                  = true

    string_attribute_constraints {
      min_length = 1
      max_length = 100
    }
  }

  # Lambda triggers — optional, wired in from the environment module
  dynamic "lambda_config" {
    for_each = var.post_confirmation_lambda_arn != null ? [1] : []
    content {
      post_confirmation = var.post_confirmation_lambda_arn
    }
  }

  # Prevent accidental deletion
  deletion_protection = "ACTIVE"

  tags = {
    Name = "souschef-${var.environment}"
  }
}

# Hosted UI domain (e.g. souschef-prod.auth.eu-west-2.amazoncognito.com)
resource "aws_cognito_user_pool_domain" "this" {
  domain       = "souschef-${var.environment}"
  user_pool_id = aws_cognito_user_pool.this.id
}

# Web app client (Next.js — no client secret, public SPA)
resource "aws_cognito_user_pool_client" "web" {
  name         = "souschef-web-${var.environment}"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
  ]

  # Prevent leaking whether a user account exists
  prevent_user_existence_errors = "ENABLED"

  # Token validity
  access_token_validity  = 1   # hours
  id_token_validity      = 1   # hours
  refresh_token_validity = 30  # days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  callback_urls = var.web_callback_urls
  logout_urls   = var.web_logout_urls

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  supported_identity_providers = ["COGNITO"]
}

# Mobile app client (Expo — no client secret, uses custom scheme for callbacks)
resource "aws_cognito_user_pool_client" "mobile" {
  name         = "souschef-mobile-${var.environment}"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
  ]

  prevent_user_existence_errors = "ENABLED"

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  callback_urls = var.mobile_callback_urls
  logout_urls   = var.mobile_logout_urls

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  supported_identity_providers = ["COGNITO"]
}
