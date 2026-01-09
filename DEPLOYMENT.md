# Deployment Guide

This guide covers deploying the Daycare Planner application to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Security Checklist](#security-checklist)
7. [Monitoring & Maintenance](#monitoring--maintenance)

## Prerequisites

### Required Services

- PostgreSQL 16+ database (managed service recommended)
- Node.js 20+ hosting (e.g., DigitalOcean, AWS, Heroku, Render)
- Domain name with SSL certificate
- Environment for secrets management

### Recommended Infrastructure

- **Database**: AWS RDS, Google Cloud SQL, or DigitalOcean Managed Postgres
- **Backend**: AWS EC2, DigitalOcean Droplet, or Platform-as-a-Service (Heroku, Render)
- **Frontend**: Vercel, Netlify, or AWS S3 + CloudFront
- **Secrets**: AWS Secrets Manager, HashiCorp Vault, or similar

## Environment Setup

### Production Environment Variables

#### Backend (.env.production)

```env
NODE_ENV=production
PORT=3001

# Database - Use managed service connection string
DB_HOST=your-db-host.region.rds.amazonaws.com
DB_PORT=5432
DB_NAME=daycare_planner_prod
DB_USER=daycare_admin
DB_PASSWORD=<STRONG_PASSWORD_FROM_SECRETS_MANAGER>

# Security - Generate strong secrets
JWT_SECRET=<GENERATE_STRONG_SECRET_256_BITS>
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# CORS - Your frontend domain
CORS_ORIGIN=https://daycare-planner.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Privacy
DATA_RETENTION_DAYS=730
ANONYMIZATION_ENABLED=true
```

#### Frontend (.env.production)

```env
VITE_API_URL=https://api.daycare-planner.yourdomain.com
```

### Generating Secrets

```bash
# Generate JWT secret (256-bit)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate database password
openssl rand -base64 32
```

## Database Setup

### 1. Create Production Database

**AWS RDS Example:**

```bash
aws rds create-db-instance \
  --db-instance-identifier daycare-planner-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16.1 \
  --master-username daycare_admin \
  --master-user-password <PASSWORD> \
  --allocated-storage 20 \
  --storage-encrypted \
  --backup-retention-period 7 \
  --vpc-security-group-ids sg-xxxxxxxx
```

### 2. Run Migrations

```bash
# Connect to production database
psql "postgresql://daycare_admin:<PASSWORD>@your-db-host:5432/daycare_planner_prod?sslmode=require"

# Run migration
\i backend/migrations/001_initial_schema.sql
```

### 3. Enable SSL Connections

Ensure your database requires SSL connections:

```sql
-- Verify SSL is enabled
SHOW ssl;

-- Require SSL for all connections
ALTER DATABASE daycare_planner_prod SET ssl TO on;
```

### 4. Backup Configuration

Set up automated backups:
- Daily snapshots with 7-day retention minimum
- Transaction log backups every 5 minutes
- Cross-region replication for disaster recovery

## Backend Deployment

### Option 1: Platform as a Service (Render, Heroku)

**Render Example:**

1. Create new Web Service
2. Connect GitHub repository
3. Set build command: `cd backend && npm install && npm run build`
4. Set start command: `cd backend && npm start`
5. Add environment variables from secrets manager
6. Enable health checks at `/health`

**render.yaml:**

```yaml
services:
  - type: web
    name: daycare-planner-api
    env: node
    buildCommand: cd backend && npm install && npm run build
    startCommand: cd backend && npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
      - key: DB_HOST
        sync: false
      - key: DB_PASSWORD
        sync: false
      - key: JWT_SECRET
        sync: false
```

### Option 2: Docker Deployment

**Production Dockerfile (backend/Dockerfile.prod):**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

USER nodejs

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

**Deploy with Docker:**

```bash
# Build image
docker build -f backend/Dockerfile.prod -t daycare-planner-backend:latest ./backend

# Run with proper security
docker run -d \
  --name daycare-backend \
  -p 3001:3001 \
  --env-file .env.production \
  --restart unless-stopped \
  --security-opt no-new-privileges:true \
  --cap-drop ALL \
  --read-only \
  daycare-planner-backend:latest
```

### Health Checks

The backend includes a health check endpoint at `/health`:

```bash
curl https://api.daycare-planner.yourdomain.com/health
# Expected: {"status":"ok","timestamp":"2024-01-09T..."}
```

## Frontend Deployment

### Option 1: Vercel (Recommended)

1. Import GitHub repository to Vercel
2. Set root directory to `frontend`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variable: `VITE_API_URL=https://api.yourdomain.com`

**vercel.json:**

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

### Option 2: Static Hosting (S3 + CloudFront)

```bash
# Build frontend
cd frontend
npm run build

# Upload to S3
aws s3 sync dist/ s3://daycare-planner-frontend --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

## Security Checklist

### Pre-Deployment

- [ ] Change all default passwords and secrets
- [ ] Enable database encryption at rest
- [ ] Enable SSL/TLS for all connections
- [ ] Configure firewall rules (database only accessible from backend)
- [ ] Set up Web Application Firewall (WAF)
- [ ] Enable rate limiting
- [ ] Configure CORS properly
- [ ] Review and test authentication flows
- [ ] Enable audit logging
- [ ] Set up security headers
- [ ] Scan for vulnerabilities: `npm audit`
- [ ] Review dependencies for known CVEs

### Post-Deployment

- [ ] Test all user flows in production
- [ ] Verify SSL certificate is valid
- [ ] Test rate limiting
- [ ] Verify database backups are working
- [ ] Set up monitoring and alerts
- [ ] Document incident response procedures
- [ ] Schedule security updates
- [ ] Conduct penetration testing

### Ongoing Security

- [ ] Monthly dependency updates
- [ ] Quarterly security audits
- [ ] Monitor audit logs for suspicious activity
- [ ] Review access controls
- [ ] Update documentation

## Monitoring & Maintenance

### Application Monitoring

**Recommended Tools:**
- **APM**: New Relic, DataDog, or Sentry
- **Logs**: CloudWatch, Papertrail, or Logtail
- **Uptime**: UptimeRobot, Pingdom, or StatusPage

### Key Metrics to Monitor

1. **Application Health**
   - API response times
   - Error rates
   - Request volume
   - Database connection pool

2. **Database**
   - Query performance
   - Connection count
   - Storage usage
   - Backup success/failure

3. **Security**
   - Failed authentication attempts
   - Rate limit triggers
   - Suspicious audit log entries

### Log Aggregation

Configure structured logging with Winston:

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Alerts Configuration

Set up alerts for:
- API error rate > 5%
- Response time > 2 seconds
- Database connection failures
- Disk space > 80% full
- Failed backup jobs
- Suspicious authentication patterns

### Backup & Recovery

**Daily Tasks:**
```bash
# Automated database backup
pg_dump -h $DB_HOST -U $DB_USER -d daycare_planner_prod \
  | gzip > backup-$(date +%Y%m%d).sql.gz

# Upload to S3
aws s3 cp backup-$(date +%Y%m%d).sql.gz \
  s3://daycare-backups/db/
```

**Recovery Procedure:**
```bash
# Download latest backup
aws s3 cp s3://daycare-backups/db/backup-20240109.sql.gz .

# Restore database
gunzip -c backup-20240109.sql.gz | \
  psql -h $DB_HOST -U $DB_USER -d daycare_planner_prod
```

### Scaling Considerations

**When to Scale:**
- Response time consistently > 1 second
- CPU usage > 70% sustained
- Database connections approaching pool limit
- Memory usage > 80%

**Horizontal Scaling:**
- Add backend instances behind load balancer
- Use connection pooling (PgBouncer)
- Implement Redis for session storage
- Enable CloudFront/CDN for frontend

**Database Scaling:**
- Increase instance size (vertical scaling)
- Add read replicas for reporting queries
- Implement database connection pooling
- Consider partitioning large tables

## Troubleshooting

### Common Issues

**Database Connection Errors:**
```bash
# Check database connectivity
psql "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:5432/$DB_NAME?sslmode=require"

# Verify firewall rules allow backend IP
# Check database connection limit
SELECT max_connections FROM pg_settings;
SELECT count(*) FROM pg_stat_activity;
```

**High Memory Usage:**
```bash
# Monitor Node.js memory
node --max-old-space-size=2048 dist/index.js

# Check for memory leaks
# Use Node.js built-in profiler or clinic.js
```

**CORS Issues:**
```bash
# Verify CORS_ORIGIN matches frontend domain
# Check browser console for specific error
# Test with curl:
curl -H "Origin: https://yourdomain.com" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS https://api.yourdomain.com/api/auth/login
```

## Rollback Procedure

In case of critical issues:

1. **Revert frontend:** Redeploy previous version
2. **Revert backend:** Roll back to previous release
3. **Database migrations:** Restore from backup if needed

```bash
# Example: Revert to previous Docker image
docker pull daycare-planner-backend:v1.2.0
docker stop daycare-backend
docker rm daycare-backend
docker run -d ... daycare-planner-backend:v1.2.0
```

## Support & Resources

- **Documentation**: This repository's README.md
- **Security Issues**: Report via GitHub security advisories
- **Status Page**: Setup status.yourdomain.com
- **Support Email**: support@yourdomain.com
