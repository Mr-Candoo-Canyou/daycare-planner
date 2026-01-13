#!/bin/bash
# Automated Hetzner Deployment Script for Daycare Planner
# Run this from your LOCAL machine, not on the server

set -e  # Exit on error

# Server configuration
# IMPORTANT: Set SERVER_IP before running this script
SERVER_IP="${SERVER_IP:-YOUR_SERVER_IP}"
SERVER_USER="root"
DEPLOY_USER="deploy"

# Usage:
# SERVER_IP=1.2.3.4 ./deploy-to-hetzner.sh
# Or edit this file and replace YOUR_SERVER_IP with your actual server IP

echo "========================================="
echo "Daycare Planner - Hetzner Deployment"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we can connect to the server
echo "Testing connection to server..."
if ! ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP "echo 'Connection successful'" 2>/dev/null; then
    print_error "Cannot connect to server. Please ensure:"
    echo "  1. You've added your SSH key or can use password authentication"
    echo "  2. The server IP is correct: $SERVER_IP"
    echo ""
    echo "To add your SSH key to the server:"
    echo "  ssh-copy-id $SERVER_USER@$SERVER_IP"
    exit 1
fi
print_status "Server connection verified"

echo ""
echo "Step 1: Updating system and installing dependencies..."
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
apt-get install -y curl git nginx certbot python3-certbot-nginx postgresql-client ufw
ENDSSH
print_status "System updated"

echo ""
echo "Step 2: Installing Docker..."
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi
ENDSSH
print_status "Docker installed"

echo ""
echo "Step 3: Creating deploy user..."
ssh $SERVER_USER@$SERVER_IP << ENDSSH
if ! id -u $DEPLOY_USER > /dev/null 2>&1; then
    adduser --disabled-password --gecos "" $DEPLOY_USER
    usermod -aG sudo,docker $DEPLOY_USER

    # Copy SSH keys
    mkdir -p /home/$DEPLOY_USER/.ssh
    cp ~/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/ 2>/dev/null || true
    chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
    chmod 700 /home/$DEPLOY_USER/.ssh
    chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys 2>/dev/null || true

    # Allow sudo without password for setup
    echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$DEPLOY_USER
fi
ENDSSH
print_status "Deploy user created"

echo ""
echo "Step 4: Configuring firewall..."
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
ufw --force enable
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw allow 80/tcp
ufw allow 443/tcp
ENDSSH
print_status "Firewall configured"

echo ""
echo "Step 5: Cloning repository..."
ssh $DEPLOY_USER@$SERVER_IP << 'ENDSSH'
cd /home/deploy
if [ -d "daycare-planner" ]; then
    cd daycare-planner
    git pull
else
    git clone https://github.com/Mr-Candoo-Canyou/daycare-planner.git
    cd daycare-planner
fi
git checkout claude/daycare-waitlist-app-VwP7D
ENDSSH
print_status "Repository cloned"

echo ""
echo "========================================="
echo "Step 6: Configuration Required"
echo "========================================="
echo ""
print_warning "You need to configure environment variables on the server."
echo ""
echo "Run these commands on your server:"
echo ""
echo "  ssh $DEPLOY_USER@$SERVER_IP"
echo "  cd daycare-planner"
echo "  nano backend/.env"
echo ""
echo "Paste this configuration (UPDATE THE SECRETS!):"
echo ""
cat << 'ENVCONFIG'
NODE_ENV=production
PORT=3001

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=daycare_planner
DB_USER=daycare_admin
DB_PASSWORD=CHANGE_ME_$(openssl rand -base64 24)

# Security - GENERATE NEW SECRETS!
JWT_SECRET=CHANGE_ME_$(openssl rand -hex 32)
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# CORS - Your domain
CORS_ORIGIN=http://${SERVER_IP}

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ENVCONFIG

echo ""
echo "To generate secure secrets, run on your local machine:"
echo "  JWT_SECRET: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
echo "  DB_PASSWORD: openssl rand -base64 32"
echo ""
read -p "Press Enter when you've created backend/.env on the server..."

echo ""
echo "Step 7: Building and starting application..."
ssh $DEPLOY_USER@$SERVER_IP << 'ENDSSH'
cd /home/deploy/daycare-planner

# Create production docker-compose file
cat > docker-compose.prod.yml << 'DOCKERCOMPOSE'
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: daycare-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: daycare_planner
      POSTGRES_USER: daycare_admin
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/migrations:/docker-entrypoint-initdb.d:ro
    networks:
      - daycare-network
    secrets:
      - db_password
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U daycare_admin"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
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

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
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

networks:
  daycare-network:

secrets:
  db_password:
    file: ./backend/.db_password
DOCKERCOMPOSE

# Extract DB password for Docker secret
grep DB_PASSWORD backend/.env | cut -d= -f2 > backend/.db_password
chmod 600 backend/.db_password

# Build and start
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

echo "Waiting for services to start..."
sleep 10

# Check status
docker compose -f docker-compose.prod.yml ps
ENDSSH
print_status "Application started"

echo ""
echo "Step 8: Configuring Nginx reverse proxy..."
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
# Create Nginx config
cat > /etc/nginx/sites-available/daycare-planner << 'NGINXCONF'
server {
    listen 80;
    server_name ${SERVER_IP};

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
NGINXCONF

# Enable site
ln -sf /etc/nginx/sites-available/daycare-planner /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t && systemctl reload nginx
ENDSSH
print_status "Nginx configured"

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
print_status "Application is now running!"
echo ""
echo "Access your application at:"
echo "  http://${SERVER_IP}"
echo ""
echo "To check status:"
echo "  ssh $DEPLOY_USER@$SERVER_IP"
echo "  cd daycare-planner"
echo "  docker compose -f docker-compose.prod.yml ps"
echo "  docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "To set up a domain with SSL:"
echo "  1. Point your domain A record to ${SERVER_IP}"
echo "  2. Update backend/.env CORS_ORIGIN to your domain"
echo "  3. Run: sudo certbot --nginx -d yourdomain.com"
echo ""
print_warning "Next steps:"
echo "  1. Test the application at http://${SERVER_IP}"
echo "  2. Register a parent account"
echo "  3. Set up a domain name and SSL certificate"
echo "  4. Configure automated backups"
echo ""
