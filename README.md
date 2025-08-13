# UberEats MCP Server Enhanced

A modern, production-ready Model Context Protocol (MCP) server for UberEats automation built with TypeScript, Redis, and enterprise-grade security features.

## 🚀 Features

### Core Functionality
- **MCP Protocol Compliance**: Native MCP server with tools, resources, and prompts
- **Session Management**: Redis-backed sessions with JWT authentication
- **n8n Integration**: Seamless workflow orchestration with circuit breakers
- **Type Safety**: Full TypeScript implementation with strict mode
- **Security**: Input validation, rate limiting, encryption, and audit logging

### Performance & Scalability
- **Horizontal Scaling**: Stateless design with Redis session storage
- **Circuit Breakers**: Fault tolerance for external services
- **Connection Pooling**: Efficient resource management
- **Caching**: Redis-based caching for optimal performance
- **Monitoring**: Built-in health checks and metrics

### Developer Experience
- **Hot Reload**: Development mode with automatic restarts
- **Comprehensive Logging**: Structured logging with pino
- **Error Handling**: Centralized error management
- **Code Quality**: ESLint, Prettier, and TypeScript strict mode
- **Documentation**: Complete API documentation and examples

## 📋 Prerequisites

- Node.js 20.0.0 or higher
- Redis 7.0 or higher
- n8n workflow automation platform
- Docker (optional, for containerized deployment)

## 🛠 Installation

### Option 1: Local Development

```bash
# Clone the repository
cd ubereats_mcp_server_enhanced

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit configuration
nano .env

# Build the project
npm run build

# Start Redis (if not running)
redis-server

# Start the server
npm start
```

### Option 2: Docker Deployment

```bash
# Copy environment configuration
cp .env.example .env

# Edit configuration for production
nano .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f ubereats-mcp
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Security (REQUIRED for production)
JWT_SECRET=your-super-secure-jwt-secret-key-change-in-production
SESSION_SECRET=your-session-secret-key-change-in-production
ENCRYPTION_KEY=your-32-character-encryption-key-change-this

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# n8n Integration
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=

# Server Configuration
NODE_ENV=production
PORT=5001
LOG_LEVEL=info
```

### MCP Client Configuration

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "ubereats": {
      "command": "node",
      "args": ["/path/to/ubereats_mcp_server_enhanced/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## 🔧 Usage

### MCP Tools

#### Login Tool
```javascript
{
  "name": "ubereats_login",
  "arguments": {
    "username": "user@example.com",
    "password": "password",
    "manualMode": false
  }
}
```

#### Add Items Tool
```javascript
{
  "name": "ubereats_add_items",
  "arguments": {
    "sessionId": "session-uuid",
    "restaurantName": "McDonald's",
    "items": [
      {
        "name": "Big Mac",
        "quantity": 2,
        "options": {
          "size": "large",
          "extras": ["cheese"]
        }
      }
    ]
  }
}
```

#### Set Address Tool
```javascript
{
  "name": "ubereats_set_address",
  "arguments": {
    "sessionId": "session-uuid",
    "address": {
      "street": "123 Main St",
      "city": "Anytown",
      "state": "CA",
      "zipCode": "90210"
    }
  }
}
```

#### Checkout Tool
```javascript
{
  "name": "ubereats_checkout",
  "arguments": {
    "sessionId": "session-uuid",
    "paymentMethodId": "saved_card_123",
    "tipAmount": 5.00
  }
}
```

### MCP Resources

#### Health Check
```
URI: ubereats://health
```
Returns server health status, system metrics, and service availability.

#### Session Information
```
URI: ubereats://sessions
```
Returns information about active sessions and session counts.

### Prompts

#### Quick Order
```javascript
{
  "name": "quick_order",
  "arguments": {
    "restaurant": "Pizza Hut",
    "items": "Large pepperoni pizza, 2 liter Coke",
    "address": "123 Main St, Anytown, CA 90210"
  }
}
```

## 🏗 Architecture

### System Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │◄──►│   MCP Server    │◄──►│   Redis Cache   │
│   (Claude)      │    │  (TypeScript)   │    │   (Sessions)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   n8n Server    │◄──►│   Playwright    │
                       │  (Workflows)    │    │  (Browser)      │
                       └─────────────────┘    └─────────────────┘
```

### Component Details

- **MCP Server**: TypeScript server implementing MCP protocol
- **Session Service**: Redis-backed session management with JWT
- **n8n Service**: Workflow orchestration with circuit breakers
- **Tools**: MCP tools for UberEats operations
- **Resources**: Information endpoints for monitoring
- **Prompts**: Pre-defined interaction templates

## 🔒 Security Features

### Authentication & Authorization
- JWT token-based session management
- Session validation on all protected operations
- Secure session storage with Redis TTL

### Input Validation
- Zod schema validation for all inputs
- XSS protection and sanitization
- SQL injection prevention (Redis NoSQL)

### Rate Limiting
- Per-endpoint rate limiting
- Global rate limiting
- Configurable limits and windows

### Data Protection
- AES-256 encryption for sensitive data
- Secure cookie handling
- Password exclusion from logs and storage

### Monitoring & Auditing
- Comprehensive audit logging
- Security event tracking
- Performance monitoring

## 📊 Monitoring & Observability

### Health Checks
```bash
# Check server health
curl http://localhost:5001/health

# Docker health check
docker-compose ps
```

### Logging
- Structured JSON logging with pino
- Configurable log levels
- Request/response logging with sensitive data redaction

### Metrics
- Redis connection health
- n8n service availability
- Circuit breaker status
- Session statistics

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

## 🚀 Deployment

### Production Deployment

1. **Environment Setup**
```bash
# Set production environment variables
export NODE_ENV=production
export JWT_SECRET="your-production-jwt-secret"
export SESSION_SECRET="your-production-session-secret"
export ENCRYPTION_KEY="your-production-encryption-key"
```

2. **Database Setup**
```bash
# Start Redis
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Or use managed Redis (AWS ElastiCache, etc.)
```

3. **Application Deployment**
```bash
# Build application
npm run build

# Start with PM2 (recommended)
pm2 start dist/index.js --name ubereats-mcp

# Or use Docker
docker-compose up -d
```

### Kubernetes Deployment

See `k8s/` directory for Kubernetes manifests (coming soon).

## 🐛 Troubleshooting

### Common Issues

#### Server Won't Start
```bash
# Check Node.js version
node --version  # Should be >= 20.0.0

# Check environment variables
npm run check-env

# Check Redis connection
redis-cli ping
```

#### Authentication Errors
```bash
# Verify JWT secret is set
echo $JWT_SECRET

# Check session in Redis
redis-cli get "ubereats:session:your-session-id"
```

#### n8n Integration Issues
```bash
# Test n8n connectivity
curl http://localhost:5678/health

# Check circuit breaker status
curl http://localhost:5001/api/circuit-breakers
```

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=debug
export ENABLE_DEBUG=true

# Start server
npm run dev
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Write tests for new features
- Update documentation
- Use conventional commits
- Ensure code passes linting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- [n8n](https://n8n.io/) for workflow automation
- [Redis](https://redis.io/) for session management
- [TypeScript](https://www.typescriptlang.org/) for type safety

## 📞 Support

- Create an issue for bug reports
- Use discussions for questions
- Check the [troubleshooting guide](#🐛-troubleshooting) first

---

**Note**: This is an enhanced version of the original Flask-based UberEats MCP server, rebuilt with modern technologies and enterprise-grade features.