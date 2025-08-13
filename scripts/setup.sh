#!/bin/bash

# Setup script for UberEats MCP Server Enhanced

set -e

echo "🚀 Setting up UberEats MCP Server Enhanced..."

# Check Node.js version
echo "📋 Checking prerequisites..."
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="20.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $REQUIRED_VERSION or higher is required. Found: $NODE_VERSION"
    exit 1
fi

echo "✅ Node.js version: $NODE_VERSION"

# Check if Redis is available
if command -v redis-cli &> /dev/null; then
    if redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis is running"
    else
        echo "⚠️  Redis is installed but not running"
        echo "   Start Redis with: redis-server"
    fi
else
    echo "⚠️  Redis is not installed"
    echo "   Install with: brew install redis (macOS) or apt-get install redis-server (Ubuntu)"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration"
    echo "   Critical: Set JWT_SECRET, SESSION_SECRET, and ENCRYPTION_KEY for production"
else
    echo "✅ .env file already exists"
fi

# Build the project
echo "🔨 Building project..."
npm run build

# Run linting
echo "🔍 Running code quality checks..."
npm run lint

# Run type checking
echo "📝 Running type checks..."
npm run type-check

# Run tests (if Redis is available)
if redis-cli ping > /dev/null 2>&1; then
    echo "🧪 Running tests..."
    npm test
else
    echo "⚠️  Skipping tests (Redis not available)"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📚 Next steps:"
echo "   1. Edit .env file with your configuration"
echo "   2. Start Redis: redis-server"
echo "   3. Start the server: npm start"
echo "   4. Or start in development mode: npm run dev"
echo ""
echo "🔗 Useful commands:"
echo "   npm run dev          - Start in development mode"
echo "   npm start            - Start in production mode"
echo "   npm test             - Run tests"
echo "   npm run build        - Build the project"
echo "   npm run lint         - Lint code"
echo "   npm run format       - Format code"
echo ""
echo "📖 Documentation: README.md"
echo "🐳 Docker: docker-compose up -d"