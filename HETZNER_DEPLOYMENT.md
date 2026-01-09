# Hetzner Deployment Guide

Complete guide to deploying Daycare Planner on a Hetzner VPS instance.

## Overview

This guide covers deploying the full stack application to a Hetzner Cloud server with:
- Ubuntu 22.04 LTS
- Docker & Docker Compose
- PostgreSQL database
- Nginx reverse proxy
- SSL certificate (Let's Encrypt)
- Automated backups

**Estimated cost:** €4-8/month depending on server size

## Step 1: Create Hetzner Server

### 1.1 Create Account & Project

1. Sign up at [Hetzner Cloud](https://console.hetzner.cloud)
2. Create a new project (e.g., "Daycare Planner")
3. Add payment method

### 1.2 Create Server Instance

**Recommended specs for production:**

| Server Type | vCPU | RAM | Storage | Price/month | Use Case |
|-------------|------|-----|---------|-------------|----------|
| CX11 | 1 | 2GB | 20GB | €4.15 | Testing/Small |
| CPX11 | 2 | 2GB | 40GB | €4.75 | Recommended Start |
| CPX21 | 3 | 4GB | 80GB | €8.90 | Production |

**Create server:**

1. Go to your project → "Add Server"
2. **Location:** Choose closest to users (Nuremberg, Helsinki, or Ashburn)
3. **Image:** Ubuntu 22.04
4. **Type:** CPX11 (recommended) or CPX21 for more users
5. **Networking:**
   - IPv4 & IPv6 (default)
   - Create and attach a Firewall (we'll configure below)
6. **SSH Key:**
   - Add your SSH public key
   - Or create one: `ssh-keygen -t ed25519 -C "your_email@example.com"`
   - Copy: `cat ~/.ssh/id_ed25519.pub`
7. **Name:** daycare-planner-prod
8. Click "Create & Buy Now"

### 1.3 Configure Firewall

In Hetzner Cloud Console:

1. Go to Firewalls → Create Firewall
2. Name: daycare-firewall
3. **Inbound Rules:**
   ```
   SSH (TCP, Port 22) - Your IP or 0.0.0.0/0
   HTTP (TCP, Port 80) - 0.0.0.0/0, ::/0
   HTTPS (TCP, Port 443) - 0.0.0.0/0, ::/0
   ```
4. **Outbound Rules:** Allow all (default)
5. Apply to server: daycare-planner-prod

## Step 2: Initial Server Setup

### 2.1 Connect to Server

```bash
# Get server IP from Hetzner console
ssh root@YOUR_SERVER_IP
```

### 2.2 Update System

```bash
apt update && apt upgrade -y
```

### 2.3 Create Non-Root User

```bash
# Create user
adduser deploy
usermod -aG sudo deploy

# Copy SSH keys
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Test login from local machine (new terminal)
ssh deploy@YOUR_SERVER_IP

# If successful, disable root SSH login
nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
systemctl restart sshd
```

### 2.4 Configure Firewall (UFW)

```bash
# Enable UFW
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

### 2.5 Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker deploy
newgrp docker

# Install Docker Compose
sudo apt install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 2.6 Install Additional Tools

```bash
sudo apt install -y git nginx certbot python3-certbot-nginx postgresql-client
```

## Step 3: Deploy Application

### 3.1 Clone Repository

```bash
cd /home/deploy
git clone https://github.com/YOUR_USERNAME/daycare-planner.git
cd daycare-planner
git checkout main  # or your production branch
```

### 3.2 Create Production Environment Files

**Backend environment:**

```bash
nano backend/.env
```

Add:
```env
NODE_ENV=production
PORT=3001

# Database - using Docker PostgreSQL
DB_HOST=postgres
DB_PORT=5432
DB_NAME=daycare_planner
DB_USER=daycare_admin
DB_PASSWORD=CHANGE_TO_STRONG_PASSWORD_HERE

# Security - Generate these!
JWT_SECRET=GENERATE_STRONG_SECRET_256_BITS
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# CORS - Your domain
CORS_ORIGIN=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Privacy
DATA_RETENTION_DAYS=730
ANONYMIZATION_ENABLED=true
```

**Generate secrets:**

```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Database Password
openssl rand -base64 32
```

**Frontend environment:**

```bash
nano frontend/.env.production
```

Add:
```env
VITE_API_URL=https://api.yourdomain.com
```

### 3.3 Create Production Docker Compose

```bash
nano docker-compose.prod.yml
```

Add:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: daycare-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: daycare_planner
      POSTGRES_USER: daycare_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/migrations:/docker-entrypoint-initdb.d:ro
    networks:
      - daycare-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U daycare_admin"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: daycare-backend
    restart: unless-stopped
    env_file:
      - ./backend/.env
    ports:
      - "127.0.0.1:3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - daycare-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    container_name: daycare-frontend
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:80"
    depends_on:
      - backend
    networks:
      - daycare-network

volumes:
  postgres_data:
    driver: local

networks:
  daycare-network:
    driver: bridge
```

### 3.4 Create Production Dockerfiles

**Backend:**

```bash
nano backend/Dockerfile.prod
```

Add:
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
```

**Frontend:**

```bash
nano frontend/Dockerfile.prod
```

Add:
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**Nginx config for frontend container:**

```bash
nano frontend/nginx.conf
```

Add:
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3.5 Build and Start Services

```bash
# Build images
docker compose -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

## Step 4: Configure Nginx Reverse Proxy

### 4.1 Create Nginx Configuration

**For API (backend):**

```bash
sudo nano /etc/nginx/sites-available/daycare-api
```

Add:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

**For Frontend:**

```bash
sudo nano /etc/nginx/sites-available/daycare-frontend
```

Add:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4.2 Enable Sites

```bash
# Enable sites
sudo ln -s /etc/nginx/sites-available/daycare-api /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/daycare-frontend /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Step 5: SSL Certificates (Let's Encrypt)

### 5.1 Point Domain to Server

In your domain registrar:
- Add A record: `yourdomain.com` → `YOUR_SERVER_IP`
- Add A record: `www.yourdomain.com` → `YOUR_SERVER_IP`
- Add A record: `api.yourdomain.com` → `YOUR_SERVER_IP`

Wait for DNS propagation (5-30 minutes):
```bash
dig yourdomain.com
```

### 5.2 Install SSL Certificates

```bash
# Get certificates for all domains
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Choose redirect HTTP to HTTPS (recommended)

# Test auto-renewal
sudo certbot renew --dry-run
```

## Step 6: Database Management

### 6.1 Access Database

```bash
# Enter PostgreSQL container
docker exec -it daycare-db psql -U daycare_admin -d daycare_planner

# Or from host
docker exec daycare-db psql -U daycare_admin -d daycare_planner -c "SELECT COUNT(*) FROM users;"
```

### 6.2 Backup Database

**Create backup script:**

```bash
nano ~/backup-database.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="daycare_backup_${DATE}.sql.gz"

mkdir -p $BACKUP_DIR

docker exec daycare-db pg_dump -U daycare_admin daycare_planner | gzip > "${BACKUP_DIR}/${FILENAME}"

# Keep only last 7 days
find $BACKUP_DIR -name "daycare_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${FILENAME}"
```

Make executable:
```bash
chmod +x ~/backup-database.sh
```

**Schedule daily backups:**

```bash
crontab -e
```

Add:
```cron
# Daily backup at 2 AM
0 2 * * * /home/deploy/backup-database.sh >> /home/deploy/backup.log 2>&1
```

### 6.3 Restore Database

```bash
# Stop backend
docker compose -f docker-compose.prod.yml stop backend

# Restore
gunzip -c /home/deploy/backups/daycare_backup_XXXXXXXX.sql.gz | \
  docker exec -i daycare-db psql -U daycare_admin -d daycare_planner

# Restart backend
docker compose -f docker-compose.prod.yml start backend
```

## Step 7: Monitoring & Maintenance

### 7.1 View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 7.2 System Monitoring

**Install monitoring tools:**

```bash
sudo apt install htop ncdu
```

**Check resource usage:**

```bash
# CPU and memory
htop

# Disk usage
df -h
ncdu /

# Docker stats
docker stats
```

### 7.3 Automatic Updates

**Enable unattended security updates:**

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### 7.4 Health Check Script

```bash
nano ~/health-check.sh
```

Add:
```bash
#!/bin/bash

# Check if services are running
if ! docker compose -f /home/deploy/daycare-planner/docker-compose.prod.yml ps | grep -q "Up"; then
    echo "ERROR: Some services are down!"
    docker compose -f /home/deploy/daycare-planner/docker-compose.prod.yml ps
    exit 1
fi

# Check API health
if ! curl -f -s http://localhost:3001/health > /dev/null; then
    echo "ERROR: API health check failed!"
    exit 1
fi

# Check frontend
if ! curl -f -s http://localhost:3000 > /dev/null; then
    echo "ERROR: Frontend health check failed!"
    exit 1
fi

echo "All services healthy"
```

Make executable:
```bash
chmod +x ~/health-check.sh
```

Run every 5 minutes:
```bash
crontab -e
```

Add:
```cron
*/5 * * * * /home/deploy/health-check.sh >> /home/deploy/health.log 2>&1
```

## Step 8: Application Updates

### 8.1 Deploy Updates

```bash
cd /home/deploy/daycare-planner

# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

### 8.2 Zero-Downtime Deployment (Optional)

For zero-downtime updates, use docker rolling updates:

```bash
# Update backend
docker compose -f docker-compose.prod.yml up -d --no-deps --build backend

# Update frontend
docker compose -f docker-compose.prod.yml up -d --no-deps --build frontend
```

## Step 9: Security Hardening

### 9.1 Fail2Ban

Protect against brute force:

```bash
sudo apt install fail2ban

sudo nano /etc/fail2ban/jail.local
```

Add:
```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
```

Start:
```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 9.2 Automatic Security Updates

Already configured in Step 7.3

### 9.3 Regular Security Audits

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Check for security updates
sudo unattended-upgrades --dry-run

# Docker security scan
docker scan daycare-backend:latest
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs backend

# Check if port is in use
sudo netstat -tulpn | grep 3001

# Restart services
docker compose -f docker-compose.prod.yml restart
```

### Database Connection Issues

```bash
# Check database is running
docker compose -f docker-compose.prod.yml ps postgres

# Check database logs
docker compose -f docker-compose.prod.yml logs postgres

# Test connection
docker exec daycare-db pg_isready -U daycare_admin
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew manually
sudo certbot renew

# Check nginx config
sudo nginx -t
```

### Out of Memory

```bash
# Check memory usage
free -h
docker stats

# Add swap (if needed)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Cost Optimization

### Use Hetzner Volumes for Database

For larger databases, use Hetzner volumes:

```bash
# Create volume in Hetzner console (€0.05/GB/month)
# Attach to server
# Mount volume
sudo mkfs.ext4 /dev/disk/by-id/scsi-0HC_Volume_XXXXX
sudo mkdir /mnt/db-volume
sudo mount /dev/disk/by-id/scsi-0HC_Volume_XXXXX /mnt/db-volume

# Update docker-compose.prod.yml
# Change postgres volume to: /mnt/db-volume:/var/lib/postgresql/data
```

### Backup to Hetzner Storage Box

Hetzner offers affordable backup storage (€3.20/month for 100GB):

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure for Hetzner Storage Box
rclone config

# Backup script
rclone copy /home/deploy/backups remote:daycare-backups
```

## Performance Tuning

### Enable Redis Caching (Optional)

For better performance with many users:

Add to docker-compose.prod.yml:
```yaml
  redis:
    image: redis:alpine
    restart: unless-stopped
    networks:
      - daycare-network
```

## Summary

Your Daycare Planner is now deployed on Hetzner!

**Access:**
- Frontend: https://yourdomain.com
- API: https://api.yourdomain.com
- Database: localhost only (secure)

**Daily Tasks:**
- Monitor logs: `docker compose logs -f`
- Check health: `~/health-check.sh`

**Weekly Tasks:**
- Check backups: `ls -lh ~/backups/`
- Review security: `sudo apt update && sudo apt upgrade`

**Monthly Tasks:**
- Review resource usage: `htop`, `df -h`
- Test backup restore
- Update dependencies

## Next Steps

1. **Test the deployment:**
   - Register a parent account
   - Add a child
   - Submit an application
   - Login as daycare admin
   - Check funder reports

2. **Set up monitoring:**
   - Consider UptimeRobot for uptime monitoring
   - Set up email alerts for critical errors

3. **Customize:**
   - Update branding
   - Configure email notifications
   - Add your privacy policy URL

**Questions?** Check the main [DEPLOYMENT.md](./DEPLOYMENT.md) for additional details.
