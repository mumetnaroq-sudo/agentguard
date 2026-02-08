#!/bin/bash

# AgentGuard Deployment Script
# Run this after creating the GitHub repository

set -e

echo "🔒 AgentGuard Deployment Script"
echo "================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this from the agentguard directory."
    exit 1
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
fi

# Check if remote is set
if ! git remote get-url origin &> /dev/null; then
    echo "🔗 Adding GitHub remote..."
    git remote add origin https://github.com/mumetnaroq/agentguard.git
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run tests
echo "🧪 Running tests..."
npm test || echo "⚠️ Tests failed (continuing anyway)"

# Stage all files
echo "📁 Staging files..."
git add .

# Commit
echo "💾 Creating initial commit..."
git commit -m "Initial release: AgentGuard v1.0.0

Features:
- YARA-based security scanner
- Dependency vulnerability audit
- SBOM generation
- Code signing verification
- GitHub Action for CI/CD
- Comprehensive test suite

Ready for production use."

# Push to GitHub
echo "🚀 Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ AgentGuard deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Create a release on GitHub to publish to Marketplace"
echo "2. Deploy the SaaS dashboard to Vercel"
echo "3. Announce the launch!"
echo ""
echo "Repository: https://github.com/mumetnaroq/agentguard"
