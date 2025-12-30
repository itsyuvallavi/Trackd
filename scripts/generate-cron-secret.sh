#!/bin/bash
# Generate a secure CRON_SECRET for GitHub Actions and Vercel

echo "Generating CRON_SECRET..."
SECRET=$(openssl rand -hex 32)
echo ""
echo "✅ Generated CRON_SECRET:"
echo "$SECRET"
echo ""
echo "📋 Copy this value and add it to:"
echo "   1. GitHub Secrets → CRON_SECRET"
echo "   2. Vercel Environment Variables → CRON_SECRET"
echo ""
