# Quick Deployment Guide - Hetzner

Step-by-step instructions to deploy Daycare Planner to your Hetzner server.

**Server Details:**
- IP: 
- User: 
- Password: 

## Step 1: Set Up SSH Key (Recommended)

On your **local machine**:

```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "hetzner-daycare"

# Copy key to server (will prompt for password)
ssh-copy-id root@YOUR_SERVER_IP
# Enter your server password when prompted

# Test connection (should work without password)
ssh root@YOUR_SERVER_IP
```

## Step 2: Initial Server Setup

Connect to your server:

```bash
ssh root@YOUR_SERVER_IP
```

Update system and install dependencies:

```bash
# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y git docker.io docker-compose nginx certbot python3-certbot-nginx ufw

# Start Docker
systemctl start docker
systemctl enable docker
```

## Step 3: Configure Firewall

```bash
# Enable firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status
```

## Step 4: Clone Repository

```bash
# Create directory
cd /opt
git clone https://github.com/Mr-Candoo-Canyou/daycare-planner.git
cd daycare-planner

# Checkout the feature branch with all the code
git checkout claude/daycare-waitlist-app-VwP7D
```

## Step 5: Configure Environment Variables

Generate secure secrets:

```bash
# Generate JWT secret
echo "JWT_SECRET=$(openssl rand -hex 32)"

# Generate database password
echo "DB_PASSWORD=$(openssl rand -base64 32)"
```

Create backend environment file:

```bash
nano backend/.env
```

Paste this (replace the CHANGE_ME values with secrets generated above):

```env
NODE_ENV=production
PORT=3001

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=daycare_planner
DB_USER=daycare_admin
DB_PASSWORD=CHANGE_ME_WITH_GENERATED_PASSWORD

# Security
JWT_SECRET=CHANGE_ME_WITH_GENERATED_SECRET
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# CORS
CORS_ORIGIN=http://YOUR_SERVER_IP

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

Save and exit (Ctrl+X, Y, Enter)

## Step 6: Start Application with Docker

```bash
cd /opt/daycare-planner

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

Wait about 30 seconds for all services to start.

## Step 7: Configure Nginx Reverse Proxy

Create Nginx configuration:

```bash
nano /etc/nginx/sites-available/daycare-planner
```

Paste this:

```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP;

    client_max_body_size 10M;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Enable the site:

```bash
# Enable site
ln -s /etc/nginx/sites-available/daycare-planner /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

## Step 8: Test Your Application

Open your browser and go to:

**http://YOUR_SERVER_IP**

You should see the Daycare Planner login page!

### Test the Application:

1. **Register a parent account**
2. **Add a child**
3. **Submit an application**
4. **Register a daycare admin account**
5. **View the waitlist**

## Step 9: Set Up Database Backups (Important!)

Create backup script:

```bash
nano /opt/backup-db.sh
```

Paste:

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

cd /opt/daycare-planner
docker-compose exec -T postgres pg_dump -U daycare_admin daycare_planner | gzip > "${BACKUP_DIR}/backup_${DATE}.sql.gz"

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_${DATE}.sql.gz"
```

Make executable and schedule:

```bash
chmod +x /opt/backup-db.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/backup-db.sh >> /opt/backup.log 2>&1") | crontab -
```

## Step 10: Monitor Your Application

### View Logs:

```bash
cd /opt/daycare-planner

# All services
docker-compose logs -f

# Just backend
docker-compose logs -f backend

# Just database
docker-compose logs -f postgres
```

### Check Service Status:

```bash
docker-compose ps
```

### Restart Services:

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
```

## Optional: Set Up Domain and SSL

If you have a domain name:

### 1. Point Domain to Server

In your domain registrar, add an A record:
- `yourdomain.com` → `YOUR_SERVER_IP`
- `www.yourdomain.com` → `YOUR_SERVER_IP`

### 2. Update Nginx Config

```bash
nano /etc/nginx/sites-available/daycare-planner
```

Change `server_name` line to:
```nginx
server_name yourdomain.com www.yourdomain.com;
```

Reload:
```bash
nginx -t && systemctl reload nginx
```

### 3. Update CORS

```bash
nano /opt/daycare-planner/backend/.env
```

Change:
```env
CORS_ORIGIN=https://yourdomain.com
```

Restart:
```bash
cd /opt/daycare-planner
docker-compose restart backend
```

### 4. Install SSL Certificate

```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts. Choose option 2 to redirect HTTP to HTTPS.

## Troubleshooting

### Services not starting:

```bash
docker-compose down
docker-compose up -d
docker-compose logs -f
```

### Check if ports are in use:

```bash
netstat -tulpn | grep -E ':(3000|3001|5432)'
```

### Frontend not loading:

```bash
docker-compose logs frontend
```

### API not responding:

```bash
docker-compose logs backend
curl http://localhost:3001/health
```

### Database connection issues:

```bash
docker-compose logs postgres
docker-compose exec postgres psql -U daycare_admin -d daycare_planner -c "SELECT 1;"
```

## Useful Commands

```bash
# Update application
cd /opt/daycare-planner
git pull
docker-compose build
docker-compose up -d

# View resource usage
docker stats

# Clean up old Docker images
docker system prune -a

# Backup database manually
/opt/backup-db.sh

# Restore database
gunzip -c /opt/backups/backup_XXXXXX.sql.gz | \
  docker-compose exec -T postgres psql -U daycare_admin -d daycare_planner
```

## Security Checklist

- [ ] Changed default root password
- [ ] SSH key authentication set up
- [ ] Firewall enabled (UFW)
- [ ] Generated strong JWT_SECRET
- [ ] Generated strong DB_PASSWORD
- [ ] Database backups scheduled
- [ ] Nginx configured correctly
- [ ] (Optional) SSL certificate installed

## Next Steps

1. **Test thoroughly** - Create test accounts for all user types
2. **Set up monitoring** - Consider UptimeRobot for uptime monitoring
3. **Configure email** - Set up SMTP for notifications (future enhancement)
4. **Add your branding** - Customize colors and logo
5. **Set up domain** - Get a proper domain name and SSL

## Support

If you encounter issues:
1. Check logs: `docker-compose logs -f`
2. Check service status: `docker-compose ps`
3. Review HETZNER_DEPLOYMENT.md for more detailed troubleshooting

---

**Your application is now live at: http://YOUR_SERVER_IP**

Enjoy your privacy-focused daycare waitlist management system! 🎉
