#!/usr/bin/env bash

# Removes all Docker containers, images, volumes, networks (except defaults),
# and build cache from the local machine. Prompts for confirmation before
# proceeding because these actions are destructive.

set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI not found in PATH. Install Docker before running this script." >&2
  exit 1
fi

echo "This will STOP and DELETE all Docker containers, images, volumes, networks (non-default),"
echo "and purge build caches on this machine. There is no undo."
read -rp "Type 'purge' to continue: " confirmation

if [[ "${confirmation:-}" != "purge" ]]; then
  echo "Aborted. Nothing was removed."
  exit 0
fi

stop_and_remove_containers() {
  local containers
  containers="$(docker ps -aq)"

  if [[ -z "${containers}" ]]; then
    echo "No containers to stop/remove."
    return
  fi

  echo "Stopping containers..."
  docker stop "${containers}" >/dev/null || true

  echo "Removing containers..."
  docker rm -f "${containers}" >/dev/null
}

remove_images() {
  local images
  images="$(docker images -aq)"

  if [[ -z "${images}" ]]; then
    echo "No images to remove."
    return
  fi

  echo "Removing images..."
  docker rmi -f "${images}" >/dev/null
}

remove_volumes() {
  local volumes
  volumes="$(docker volume ls -q)"

  if [[ -z "${volumes}" ]]; then
    echo "No volumes to remove."
    return
  fi

  echo "Removing volumes..."
  docker volume rm "${volumes}" >/dev/null
}

remove_networks() {
  local networks
  networks="$(docker network ls --format '{{.ID}} {{.Name}}' \
    | awk '$2 != \"bridge\" && $2 != \"host\" && $2 != \"none\" {print $1}')"

  if [[ -z "${networks}" ]]; then
    echo "No custom networks to remove."
    return
  fi

  echo "Removing custom networks..."
  docker network rm "${networks}" >/dev/null
}

stop_and_remove_containers
remove_images
remove_volumes
remove_networks

echo "Running docker system prune..."
docker system prune -a --volumes -f >/dev/null

echo "Running docker builder prune..."
docker builder prune -a -f >/dev/null

echo "Docker cleanup complete."
