# Prompts Portal Web Frontend

Enterprise-grade React-based web interface for the Prompts Portal platform, providing advanced prompt management, real-time collaboration, and analytics capabilities.

## Features

- 🚀 Advanced prompt management and editing with real-time validation
- 👥 Real-time collaboration with WebSocket integration
- 📊 Interactive analytics dashboard with data visualization
- 🔐 Team workspace management with role-based access control
- 🤖 AI model integration with multiple providers
- 📝 Version control and prompt history tracking
- 📋 Customizable templates and variables system

## Prerequisites

### Required Software
- Node.js >= 20.0.0 LTS
- npm >= 9.0.0
- Git >= 2.40.0

### Recommended IDE Setup
- Visual Studio Code with extensions:
  - ESLint
  - Prettier
  - TypeScript
  - Error Lens
  - GitLens

## Installation

1. Clone the repository with Git LFS support:
```bash
git clone https://github.com/your-org/prompts-portal
cd prompts-portal/src/web
```

2. Install dependencies:
```bash
npm ci
```

3. Configure environment variables:
```bash
cp .env.example .env
```

4. Start development server:
```bash
npm run dev
```

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Create optimized production build |
| `npm run test` | Run comprehensive test suite |
| `npm run lint` | Run ESLint and Prettier checks |
| `npm run analyze` | Analyze bundle size |
| `npm run typecheck` | Run TypeScript type checking |

### Environment Variables

```env
# Required
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3001

# Optional
VITE_AI_PROVIDERS={"openai":true,"anthropic":true,"googleai":true}
VITE_ANALYTICS_ID=your-analytics-id
```

## Project Structure

```
src/
├── assets/          # Static assets
├── components/      # Reusable UI components
├── config/          # Configuration files
├── features/        # Feature-based modules
├── hooks/          # Custom React hooks
├── layouts/        # Page layouts
├── lib/            # Utility functions
├── pages/          # Route pages
├── services/       # API services
├── store/          # Redux store
└── types/          # TypeScript definitions
```

## Testing

- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- E2E tests: `npm run test:e2e`
- Coverage report: `npm run test:coverage`

### Testing Guidelines
- Maintain >80% code coverage
- Follow AAA (Arrange-Act-Assert) pattern
- Mock external dependencies
- Use React Testing Library best practices

## Deployment

### Production Build
```bash
npm run build
```

### Docker Deployment
```bash
docker build -t prompts-portal-web .
docker run -p 80:80 prompts-portal-web
```

## Security Considerations

- All API requests must use HTTPS
- Implement CSP headers
- Regular dependency audits: `npm audit`
- Secure cookie handling
- XSS prevention
- CSRF protection
- Input sanitization

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push branch: `git push origin feature/name`
5. Submit pull request

### Code Style
- Follow ESLint configuration
- Use Prettier for formatting
- Follow conventional commits

## Troubleshooting

### Common Issues

1. Node version mismatch
```bash
nvm use
```

2. Dependency conflicts
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

3. Environment configuration
- Verify .env file exists
- Check variable names match .env.example
- Validate API endpoints

### Support

- GitHub Issues: Report bugs and feature requests
- Documentation: [Internal Wiki Link]
- Team Channel: #prompts-portal-frontend

## License

Copyright © 2024 Your Organization. All rights reserved.