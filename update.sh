#!/bin/bash
#
# Daycare Planner - Quick Update Script
# Updates the application to the latest version
#
# Usage: bash update.sh
#

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

INSTALL_DIR="/opt/daycare-planner"
BRANCH="claude/daycare-waitlist-app-VwP7D"

echo "========================================="
echo "Daycare Planner - Update Script"
echo "========================================="
echo ""

if [ ! -d "$INSTALL_DIR" ]; then
    echo "Error: Application not found at $INSTALL_DIR"
    echo "Please run deploy.sh first"
    exit 1
fi

cd $INSTALL_DIR

# Backup database before update
print_info "Creating backup before update..."
/opt/backup-daycare.sh
print_success "Backup created"

# Pull latest code
print_info "Pulling latest code..."
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH
print_success "Code updated"

# Rebuild containers
print_info "Rebuilding application..."
docker compose build
print_success "Build complete"

# Restart with zero downtime
print_info "Restarting services..."
docker compose up -d
print_success "Services restarted"

# Wait for services
print_info "Waiting for services to stabilize..."
sleep 10

# Check status
print_info "Checking service status..."
docker compose ps

# Check health
if curl -sf http://localhost:3001/health > /dev/null; then
    print_success "Backend is healthy"
else
    print_warning "Backend health check failed"
fi

if curl -sf http://localhost:3000 > /dev/null; then
    print_success "Frontend is healthy"
else
    print_warning "Frontend health check failed"
fi

echo ""
echo "========================================="
print_success "Update completed successfully!"
echo "========================================="
echo ""
echo "View logs: docker compose logs -f"
echo ""
