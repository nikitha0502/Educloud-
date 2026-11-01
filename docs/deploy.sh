#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — EduCloud Deployment Script
# Deploys backend (SAM) and frontend (S3 + CloudFront)
# ─────────────────────────────────────────────────────────────────────────────

set -e  # Exit on any error

STACK_NAME="educloud-stack"
REGION="${AWS_REGION:-us-east-1}"
STAGE="${STAGE:-prod}"

echo "🚀 EduCloud Deployment Script"
echo "────────────────────────────────────────────"
echo "Stack:  $STACK_NAME"
echo "Region: $REGION"
echo "Stage:  $STAGE"
echo ""

# ── 1. Verify AWS credentials ──────────────────────────────────────────────
echo "🔑 Verifying AWS credentials..."
aws sts get-caller-identity > /dev/null 2>&1 || {
  echo "❌ AWS credentials not configured. Run: aws configure"
  exit 1
}
echo "✅ Credentials OK"

# ── 2. Install backend dependencies ──────────────────────────────────────
echo ""
echo "📦 Installing backend dependencies..."
cd backend && npm install --production && cd ..
echo "✅ Dependencies installed"

# ── 3. Run tests ──────────────────────────────────────────────────────────
echo ""
echo "🧪 Running backend tests..."
cd backend && npm test && cd ..
echo "✅ All tests passed"

# ── 4. Deploy backend with SAM ────────────────────────────────────────────
echo ""
echo "☁️  Deploying backend infrastructure (SAM)..."
cd infrastructure
sam build
sam deploy \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides Stage="$STAGE" \
  --no-fail-on-empty-changeset \
  --resolve-s3
cd ..
echo "✅ Backend deployed"

# ── 5. Get stack outputs ──────────────────────────────────────────────────
echo ""
echo "📋 Fetching stack outputs..."
API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" \
  --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolId'].OutputValue" \
  --output text)

CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoClientId'].OutputValue" \
  --output text)

CF_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" \
  --output text)

echo "✅ Outputs retrieved"
echo ""
echo "API Gateway URL:  $API_URL"
echo "Cognito Pool ID:  $USER_POOL_ID"
echo "Cognito Client:   $CLIENT_ID"
echo "CloudFront URL:   $CF_URL"

# ── 6. Auto-patch frontend config ─────────────────────────────────────────
echo ""
echo "⚙️  Updating frontend config..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
S3_BUCKET="educloud-assignments-${ACCOUNT_ID}-${STAGE}"

# Patch config.js
sed -i.bak \
  -e "s|USE_MOCK: true|USE_MOCK: false|" \
  -e "s|YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod|${API_URL#https://}|" \
  -e "s|us-east-1_XXXXXXXXX|$USER_POOL_ID|" \
  -e "s|XXXXXXXXXXXXXXXXXXXXXXXXXX|$CLIENT_ID|" \
  -e "s|us-east-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX|$REGION|" \
  -e "s|educloud-assignments-bucket|$S3_BUCKET|" \
  frontend/js/config.js

echo "✅ Config updated"

# ── 7. Deploy frontend to S3 ──────────────────────────────────────────────
echo ""
echo "📁 Deploying frontend to S3..."
FRONTEND_BUCKET="educloud-frontend-${ACCOUNT_ID}-${STAGE}"
aws s3 sync frontend/ s3://"$FRONTEND_BUCKET"/ \
  --delete \
  --cache-control "max-age=31536000,public" \
  --exclude "*.html"
aws s3 sync frontend/ s3://"$FRONTEND_BUCKET"/ \
  --delete \
  --cache-control "no-cache" \
  --include "*.html"
echo "✅ Frontend uploaded"

# ── 8. Invalidate CloudFront ──────────────────────────────────────────────
echo ""
echo "🔄 Invalidating CloudFront cache..."
CF_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text 2>/dev/null || echo "")

if [ -n "$CF_ID" ]; then
  aws cloudfront create-invalidation --distribution-id "$CF_ID" --paths "/*" > /dev/null
  echo "✅ Cache invalidated"
fi

# ── Done ──────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "════════════════════════════════════════════"
echo ""
echo "🌐 Application URL: $CF_URL"
echo "📚 API Base URL:    $API_URL"
echo ""
echo "Demo accounts will need to be re-registered"
echo "on the live AWS platform."
