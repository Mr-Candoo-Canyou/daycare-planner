#!/bin/bash
#
# Daycare Planner - Automated Hetzner Deployment Script
# Run this script on your Hetzner server as root
#
# Usage: bash deploy.sh
#

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Server configuration
REPO_URL="https://github.com/Mr-Candoo-Canyou/daycare-planner.git"
BRANCH="claude/daycare-waitlist-app-VwP7D"
INSTALL_DIR="/opt/daycare-planner"
DEPLOY_USER="deploy"

# Function to print colored output
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use: sudo bash deploy.sh)"
    exit 1
fi

print_header "Daycare Planner - Automated Deployment"
echo "This script will deploy the Daycare Planner application on this server."
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Step 1: Update system
print_header "Step 1/10: Updating System"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
print_success "System updated"

# Step 2: Install dependencies
print_header "Step 2/10: Installing Dependencies"
apt-get install -y \
    curl \
    git \
    nginx \
    certbot \
    python3-certbot-nginx \
    ufw \
    postgresql-client \
    htop \
    ncdu
print_success "Dependencies installed"

# Step 3: Install Docker
print_header "Step 3/10: Installing Docker"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    print_success "Docker installed"
else
    print_info "Docker already installed"
fi

# Install Docker Compose plugin
if ! docker compose version &> /dev/null; then
    apt-get install -y docker-compose-plugin
    print_success "Docker Compose installed"
else
    print_info "Docker Compose already installed"
fi

# Step 4: Configure firewall
print_header "Step 4/10: Configuring Firewall"
ufw --force enable
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw allow 80/tcp
ufw allow 443/tcp
ufw status
print_success "Firewall configured"

# Step 5: Clone/Update repository
print_header "Step 5/10: Setting Up Application"
if [ -d "$INSTALL_DIR" ]; then
    print_info "Application directory exists, updating..."
    cd $INSTALL_DIR
    git fetch origin
    git checkout $BRANCH
    git pull origin $BRANCH
    print_success "Application updated"
else
    print_info "Cloning application..."
    git clone -b $BRANCH $REPO_URL $INSTALL_DIR
    cd $INSTALL_DIR
    print_success "Application cloned"
fi

# Step 6: Generate secrets
print_header "Step 6/10: Generating Secure Secrets"

if [ ! -f "$INSTALL_DIR/backend/.env" ]; then
    print_info "Generating new environment file..."

    # Generate secrets
    JWT_SECRET=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -base64 32)

    # Get server IP
    SERVER_IP=$(curl -s ifconfig.me)

    cat > $INSTALL_DIR/backend/.env << EOF
NODE_ENV=production
PORT=3001

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=daycare_planner
DB_USER=daycare_admin
DB_PASSWORD=${DB_PASSWORD}

# Security
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# CORS - Update this with your domain
CORS_ORIGIN=http://${SERVER_IP}

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Privacy
DATA_RETENTION_DAYS=730
ANONYMIZATION_ENABLED=true
EOF

    print_success "Environment file created"
    print_warning "IMPORTANT: Database password and JWT secret generated"
    print_warning "Backup these credentials: $INSTALL_DIR/backend/.env"
else
    print_info "Environment file already exists, skipping generation"
fi

# Step 7: Start application with Docker
print_header "Step 7/10: Starting Application"

cd $INSTALL_DIR

# Stop existing containers
docker compose down 2>/dev/null || true

# Build and start
docker compose build
docker compose up -d

# Wait for services to start
print_info "Waiting for services to start..."
sleep 15

# Check status
if docker compose ps | grep -q "Up"; then
    print_success "Application started successfully"
    docker compose ps
else
    print_error "Some services failed to start"
    docker compose logs
    exit 1
fi

# Step 8: Configure Nginx
print_header "Step 8/10: Configuring Nginx Reverse Proxy"

# Get server IP
SERVER_IP=$(curl -s ifconfig.me)

cat > /etc/nginx/sites-available/daycare-planner << 'NGINXCONF'
server {
    listen 80;
    server_name _;

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

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3001/health;
        access_log off;
    }
}
NGINXCONF

# Enable site
ln -sf /etc/nginx/sites-available/daycare-planner /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t
systemctl enable nginx
systemctl restart nginx

print_success "Nginx configured"

# Step 9: Set up database backups
print_header "Step 9/10: Configuring Automated Backups"

mkdir -p /opt/backups

cat > /opt/backup-daycare.sh << 'BACKUPSCRIPT'
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="daycare_backup_${DATE}.sql.gz"

mkdir -p $BACKUP_DIR

cd /opt/daycare-planner
docker compose exec -T postgres pg_dump -U daycare_admin daycare_planner | gzip > "${BACKUP_DIR}/${FILENAME}"

# Keep only last 7 days
find $BACKUP_DIR -name "daycare_backup_*.sql.gz" -mtime +7 -delete

echo "$(date): Backup completed - ${FILENAME}" >> /opt/backup.log
BACKUPSCRIPT

chmod +x /opt/backup-daycare.sh

# Add to crontab if not already there
if ! crontab -l 2>/dev/null | grep -q "backup-daycare.sh"; then
    (crontab -l 2>/dev/null; echo "0 2 * * * /opt/backup-daycare.sh") | crontab -
    print_success "Daily backups scheduled (2 AM)"
else
    print_info "Backup cron job already configured"
fi

# Step 10: Create system admin user
print_header "Step 10/10: Creating System Administrator Account"

echo ""
echo "Let's create your first system administrator account."
echo ""

read -p "Admin Email: " ADMIN_EMAIL
read -sp "Admin Password: " ADMIN_PASSWORD
echo ""
read -p "Admin First Name: " ADMIN_FIRSTNAME
read -p "Admin Last Name: " ADMIN_LASTNAME

# Hash password using bcrypt via Node.js
HASHED_PASSWORD=$(docker compose exec -T backend node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('${ADMIN_PASSWORD}', 12, (err, hash) => {
  if (err) throw err;
  console.log(hash);
  process.exit(0);
});
")

# Insert admin user
docker compose exec -T postgres psql -U daycare_admin -d daycare_planner << EOF
INSERT INTO users (email, password_hash, role, first_name, last_name, is_active, email_verified)
VALUES (
  '${ADMIN_EMAIL}',
  '${HASHED_PASSWORD}',
  'system_admin',
  '${ADMIN_FIRSTNAME}',
  '${ADMIN_LASTNAME}',
  true,
  true
)
ON CONFLICT (email) DO UPDATE
SET role = 'system_admin';
EOF

print_success "System administrator created: ${ADMIN_EMAIL}"

# Final summary
print_header "Deployment Complete!"

echo -e "${GREEN}Your Daycare Planner application is now running!${NC}"
echo ""
echo "Access your application:"
echo "  URL: http://${SERVER_IP}"
echo ""
echo "System Administrator Login:"
echo "  Email: ${ADMIN_EMAIL}"
echo "  Password: [the password you entered]"
echo ""
echo "Important files:"
echo "  Application: $INSTALL_DIR"
echo "  Environment: $INSTALL_DIR/backend/.env"
echo "  Backups: /opt/backups"
echo "  Nginx config: /etc/nginx/sites-available/daycare-planner"
echo ""
echo "Useful commands:"
echo "  View logs: cd $INSTALL_DIR && docker compose logs -f"
echo "  Restart: cd $INSTALL_DIR && docker compose restart"
echo "  Stop: cd $INSTALL_DIR && docker compose down"
echo "  Start: cd $INSTALL_DIR && docker compose up -d"
echo "  Backup now: /opt/backup-daycare.sh"
echo ""
echo "Next steps:"
echo "  1. Visit http://${SERVER_IP} to test the application"
echo "  2. Login with your admin account"
echo "  3. (Optional) Set up a domain name and SSL certificate"
echo "     Run: certbot --nginx -d yourdomain.com"
echo "  4. Update CORS_ORIGIN in $INSTALL_DIR/backend/.env to your domain"
echo ""
print_success "Deployment script completed successfully!"
