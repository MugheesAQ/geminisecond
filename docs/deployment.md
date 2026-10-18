# Deployment & Production Architecture
## Unified Business Management Platform

### 1. Production Containerization
The solution provides production-ready Dockerfiles for the Web client, API server, and Background Worker:
- Multi-stage Docker builds utilizing lightweight Node 22 Alpine images.
- Non-root execution (`USER node`) for vulnerability minimization.
- Explicit health checks on `/api/health`.

### 2. Local Startup Workflow
```bash
# Build and run all services
docker compose up --build -d

# Check service logs
docker compose logs -f api worker
```

### 3. Environment Configuration
Configuration is injected through environment variables defined in `.env.example`. Secrets are never committed to git.
