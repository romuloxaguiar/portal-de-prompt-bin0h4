# Prompts Portal Backend

Enterprise-grade backend services for the Prompts Portal platform, providing secure and scalable prompt management, real-time analytics, and team collaboration features.

## Architecture Overview

Cloud-native microservices architecture with API Gateway, Analytics Service, Collaboration Service, and Prompt Service, built for high availability and horizontal scaling.

### Core Services
- API Gateway (Port 3000) - Request routing and authentication
- Analytics Service (Port 3001) - Real-time metrics and reporting
- Collaboration Service (Port 3002) - Real-time team features
- Prompt Service (Port 3003) - Prompt management and versioning

### Infrastructure Components
- Redis Cache (Port 6379) - High-performance caching
- Cosmos DB - Scalable document storage
- Prometheus (Port 9090) - Metrics collection
- Grafana (Port 3000) - Monitoring dashboard

### Security Components
- OAuth 2.0 Provider - Authentication service
- Key Vault - Secret management
- WAF - Web application firewall
- TLS Termination - Secure communication

## Prerequisites

- Node.js >= 20.0.0 LTS
- npm >= 9.0.0
- Docker >= 24.0.0
- Docker Compose >= 2.0.0
- Kubernetes >= 1.27.0
- Helm >= 3.0.0

## Getting Started

### Installation
```bash
git clone <repository-url>
cd src/backend
npm install
npm run prepare
cp .env.example .env
```

### Development
```bash
npm run dev
docker-compose up
kubectl apply -f k8s/
```

### Testing
```bash
npm run test
npm run test:coverage
npm run test:e2e
```

### Production
```bash
npm run build
docker-compose -f docker-compose.prod.yml up
helm install prompts-portal ./helm
```

## Environment Configuration

Required environment variables:

| Variable | Description |
|----------|-------------|
| NODE_ENV | Environment (development/staging/production) |
| PORT | Service port number |
| REDIS_HOST | Redis cache hostname |
| REDIS_PORT | Redis cache port |
| DB_URI | Cosmos DB connection string |
| DB_NAME | Database name |
| OAUTH_CLIENT_ID | OAuth client identifier |
| OAUTH_CLIENT_SECRET | OAuth client secret |
| JWT_SECRET | JWT signing key |
| API_RATE_LIMIT | API rate limit per hour |
| LOG_LEVEL | Logging verbosity |

## API Documentation

### REST Endpoints

| Endpoint | Description |
|----------|-------------|
| /api/v1/prompts | Prompt CRUD operations |
| /api/v1/analytics | Usage statistics and metrics |
| /api/v1/workspaces | Team workspace management |
| /api/v1/auth | Authentication and authorization |
| /api/v1/health | Service health checks |
| /api/v1/metrics | Prometheus metrics |

## Security Implementation

The backend implements enterprise-grade security features:

- OAuth 2.0 authentication with PKCE
- JWT token validation and refresh
- Role-based access control (RBAC)
- AES-256 data encryption at rest
- TLS 1.3 for data in transit
- Rate limiting and DDoS protection
- Audit logging and monitoring
- Security headers and CORS policy

## Project Information

- Project: @prompts-portal/backend
- Version: 1.0.0
- License: MIT
- Repository: github:organization/prompts-portal

## Contributing

Please refer to our [Contributing Guidelines](CONTRIBUTING.md) for information about how to get involved.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.