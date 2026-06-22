# infrastructure/terraform

All AWS infrastructure for sousChef, defined as Terraform code.

## Why Terraform

- Infrastructure changes are reviewed in PRs (the plan is posted as a comment automatically)
- Easy to tear down and recreate environments
- Drift detection — the state file is the source of truth, not what happens to be deployed
- Modules make it easy to provision consistent resources (e.g. each new Lambda follows the same pattern)

## Structure

```
infrastructure/terraform/
├── bootstrap/              # One-time setup — S3 state bucket + DynamoDB lock table
│   └── main.tf
├── modules/                # Reusable modules
│   ├── lambda/             # Lambda function + IAM role + basic config
│   ├── cognito/            # User Pool, app clients, hosted UI
│   └── api_gateway/        # HTTP API v2 + CORS + access logging
└── environments/
    └── prod/               # Production root module
        ├── main.tf         # All resource definitions and module calls
        ├── variables.tf    # Input variables
        └── outputs.tf      # Exported values (API URL, etc.)
```

## What's provisioned

### Cognito (`modules/cognito`)
- **User Pool** — handles sign-up, sign-in, and email verification
- **Web app client** — used by `apps/web` (no client secret, PKCE flow)
- **Mobile app client** — used by `apps/mobile` (custom scheme callback)
- **Post-confirmation trigger** — fires the `cognito-post-confirmation` Lambda after a user verifies their email

### Lambda (`modules/lambda`)
Each Lambda gets:
- An IAM execution role with CloudWatch Logs permissions
- A zipped bundle sourced from `backend/dist/lambda/`
- Environment variables passed from Terraform variables (never hardcoded)

Current Lambdas:
- `souschef-prod-cognito-post-confirmation` — creates the user record in Postgres on first sign-up
- `souschef-prod-recipes` — handles all recipe CRUD + URL import

### API Gateway (`modules/api_gateway`)
- HTTP API v2 (not REST API — lighter, cheaper, better for Lambda proxy)
- CORS configured for `https://souschef.app` and `http://localhost:3000`
- Access logging to CloudWatch (14-day retention)
- Auto-deploy stage

### CloudWatch Log Groups
One log group per Lambda, 14-day retention. Created outside the Lambda module to avoid Terraform dependency cycles.

## Remote state

State is stored in S3 with DynamoDB locking to prevent concurrent applies:

- **Bucket**: `souschef-terraform-state` (eu-west-2)
- **Lock table**: `souschef-terraform-locks`
- **Key**: `prod/terraform.tfstate`

These were created by the bootstrap module and must exist before running any environment module.

## CI/CD

Terraform runs are fully automated:

- **On PR**: `terraform plan` runs and the diff is posted as a PR comment
- **On merge to main**: `terraform apply` runs automatically

The workflows use GitHub Actions secrets for AWS credentials and sensitive variables (`TF_VAR_database_url`). Never run `terraform apply` manually against prod.

## Adding a new Lambda

1. Add an esbuild entry point to `backend/scripts/bundle-lambdas.mjs`
2. In `environments/prod/main.tf`, add:
   - `data "archive_file"` to zip the built bundle
   - `module "<name>"` using `../../modules/lambda`
   - `aws_cloudwatch_log_group` for the Lambda's logs
   - `aws_lambda_permission` to allow API Gateway to invoke it
   - `aws_apigatewayv2_integration` to connect it to the API
   - `aws_apigatewayv2_route` for each route it handles

## Running locally (emergency / debugging)

Only do this for investigation — never for actual infrastructure changes.

```bash
cd infrastructure/terraform/environments/prod

# Initialise (fetches providers and state)
terraform init

# See what would change
terraform plan

# Never run apply manually
```

## Tags

All resources are tagged with:
```
Project     = "souschef"
Environment = "prod"
ManagedBy   = "terraform"
```

This makes it easy to find sousChef resources in the AWS console and track costs.

## Cost breakdown (approximate)

| Service | Free tier | Beyond free tier |
|---|---|---|
| Lambda | 1M requests/month, 400K GB-seconds | ~$0.20 per 1M requests |
| API Gateway (HTTP API) | 1M requests/month (12 months from account creation) | ~$1 per 1M requests |
| Cognito | 50,000 MAUs | ~$0.0055 per MAU above that |
| CloudWatch Logs | 5GB ingestion/month | ~$0.50/GB |
| S3 (state bucket) | 5GB, 20K GET/2K PUT | Negligible |
| DynamoDB (lock table) | 25GB, 25 RCU/WCU | Negligible |
| Neon (Postgres) | Free tier: 0.5GB storage, scale to zero | $19/month Pro plan when needed |

At side-project scale (small user base, low traffic) the monthly AWS bill should be near zero.
