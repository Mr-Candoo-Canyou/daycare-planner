#!/bin/bash
# SSH Setup Script for Hetzner Server
# This sets up SSH key authentication for secure access

SERVER_IP="178.156.157.159"
SERVER_USER="root"
SERVER_PASSWORD="rsWquxnkNWLke3MPXPrs"

echo "========================================="
echo "Setting up SSH Key Authentication"
echo "========================================="
echo ""

# Check if SSH key exists
if [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "No SSH key found. Generating new ED25519 key..."
    ssh-keygen -t ed25519 -C "daycare-planner-deployment" -f ~/.ssh/id_ed25519 -N ""
    echo "✓ SSH key generated"
else
    echo "✓ SSH key already exists"
fi

echo ""
echo "Your public key:"
cat ~/.ssh/id_ed25519.pub
echo ""

echo "Copying SSH key to server..."
# Use sshpass if available, otherwise provide manual instructions
if command -v sshpass &> /dev/null; then
    sshpass -p "$SERVER_PASSWORD" ssh-copy-id -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP
    echo "✓ SSH key copied successfully"
else
    echo "sshpass not found. Please run manually:"
    echo ""
    echo "  ssh-copy-id $SERVER_USER@$SERVER_IP"
    echo ""
    echo "When prompted, enter password: $SERVER_PASSWORD"
    echo ""
    read -p "Press Enter after you've copied the key..."
fi

echo ""
echo "Testing SSH connection..."
if ssh -o BatchMode=yes -o ConnectTimeout=5 $SERVER_USER@$SERVER_IP "echo 'SSH authentication successful!'" 2>/dev/null; then
    echo "✓ SSH key authentication working!"
    echo ""
    echo "You can now connect without password:"
    echo "  ssh $SERVER_USER@$SERVER_IP"
else
    echo "✗ SSH key authentication failed. Please try manual setup:"
    echo "  ssh-copy-id $SERVER_USER@$SERVER_IP"
    exit 1
fi

echo ""
echo "========================================="
echo "SSH Setup Complete!"
echo "========================================="
echo ""
echo "Next: Run the deployment script:"
echo "  ./deploy-to-hetzner.sh"
echo ""
