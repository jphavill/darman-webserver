#!/bin/bash

# UFW setup for darman-webserver
# Run this script on your Ubuntu server

echo "Configuring UFW firewall..."

# Allow SSH from Tailscale
sudo ufw allow in on tailscale0

# Allow localhost Docker traffic
sudo ufw allow in on docker0

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Enable UFW (will prompt for confirmation)
echo "About to enable UFW. Press Ctrl+C to cancel."
sleep 3
sudo ufw enable

# Show status
sudo ufw status verbose
