data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "this" {
  name               = "${var.function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

# Basic execution role — allows writing logs to CloudWatch
resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Optional additional policy (e.g. Secrets Manager, S3)
resource "aws_iam_role_policy" "extra" {
  count  = var.policy_json != null ? 1 : 0
  name   = "${var.function_name}-policy"
  role   = aws_iam_role.this.id
  policy = var.policy_json
}

resource "aws_lambda_function" "this" {
  function_name = var.function_name
  role          = aws_iam_role.this.arn
  runtime       = "nodejs20.x"
  handler       = var.handler
  filename      = var.zip_path
  timeout       = var.timeout_seconds
  memory_size   = var.memory_mb

  source_code_hash = filebase64sha256(var.zip_path)

  environment {
    variables = var.environment_variables
  }

  tags = {
    Name = var.function_name
  }
}

# Allow Cognito (or other AWS services) to invoke this Lambda
resource "aws_lambda_permission" "invoker" {
  count         = var.invoker_principal != null ? 1 : 0
  statement_id  = "AllowInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = var.invoker_principal
  source_arn    = var.invoker_source_arn
}
