#!/bin/bash

# Docker Complete Cleanup Script
# Removes all containers, images, volumes, and networks

set -e

echo "=================================="
echo "Docker Complete Cleanup Script"
echo "=================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running or not installed"
    exit 1
fi

echo "This will remove:"
echo "  - All containers (running and stopped)"
echo "  - All images"
echo "  - All volumes"
echo "  - All custom networks"
echo "  - All build cache"
echo ""

read -p "Are you sure you want to continue? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "Starting cleanup..."
echo ""

# Stop all running containers
echo "→ Stopping all running containers..."
if [ "$(docker ps -q)" ]; then
    docker stop $(docker ps -q)
    echo "✓ All running containers stopped"
else
    echo "✓ No running containers to stop"
fi

# Remove all containers
echo "→ Removing all containers..."
if [ "$(docker ps -aq)" ]; then
    docker rm -f $(docker ps -aq)
    echo "✓ All containers removed"
else
    echo "✓ No containers to remove"
fi

# Remove all images
echo "→ Removing all images..."
if [ "$(docker images -q)" ]; then
    docker rmi -f $(docker images -q)
    echo "✓ All images removed"
else
    echo "✓ No images to remove"
fi

# Remove all volumes
echo "→ Removing all volumes..."
if [ "$(docker volume ls -q)" ]; then
    docker volume rm $(docker volume ls -q)
    echo "✓ All volumes removed"
else
    echo "✓ No volumes to remove"
fi

# Remove all custom networks
echo "→ Removing all custom networks..."
if [ "$(docker network ls -q -f type=custom)" ]; then
    docker network rm $(docker network ls -q -f type=custom) 2>/dev/null || true
    echo "✓ All custom networks removed"
else
    echo "✓ No custom networks to remove"
fi

# Prune system (removes build cache and other dangling resources)
echo "→ Pruning system (removing build cache)..."
docker system prune -a -f --volumes
echo "✓ System pruned"

echo ""
echo "=================================="
echo "Cleanup Complete!"
echo "=================================="
echo ""

# Show current Docker status
echo "Current Docker status:"
echo "  Containers: $(docker ps -a | wc -l | xargs echo $(expr $(cat) - 1))"
echo "  Images: $(docker images | wc -l | xargs echo $(expr $(cat) - 1))"
echo "  Volumes: $(docker volume ls | wc -l | xargs echo $(expr $(cat) - 1))"
echo "  Networks: $(docker network ls | wc -l | xargs echo $(expr $(cat) - 1))"
