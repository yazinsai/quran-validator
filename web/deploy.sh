#!/bin/bash
set -e

APP_NAME="quran-validator"
DOKKU_HOST="dokku@dokku-server"

echo "🚀 Deploying $APP_NAME to Dokku..."

# Navigate to repo root
cd "$(dirname "$0")/.."

# Add dokku remote if it doesn't exist
if ! git remote | grep -q "^dokku$"; then
  echo "Adding dokku remote..."
  git remote add dokku "$DOKKU_HOST:$APP_NAME"
fi

# Push the web subdirectory to dokku (force push for clean deploys)
echo "Pushing web/ subdirectory..."
git push dokku $(git subtree split --prefix web):main --force

echo "✅ Deployed to https://$APP_NAME.whhite.com"
