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
read -rp "Proceed with purge? [y/N]: " confirmation

if [[ ! "${confirmation:-}" =~ ^[Yy](es)?$ ]]; then
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
  if ! docker stop ${containers}; then
    echo "Warning: some containers failed to stop; attempting to kill them..." >&2
    docker kill ${containers} || true
  fi

  echo "Removing containers..."
  if ! docker rm -f ${containers}; then
    echo "Warning: some containers could not be removed." >&2
  fi
}

remove_images() {
  local images
  images="$(docker images -aq)"

  if [[ -z "${images}" ]]; then
    echo "No images to remove."
    return
  fi

  echo "Removing images..."
  if ! docker rmi -f ${images}; then
    echo "Warning: some images could not be removed." >&2
  fi
}

remove_volumes() {
  local volumes
  volumes="$(docker volume ls -q)"

  if [[ -z "${volumes}" ]]; then
    echo "No volumes to remove."
    return
  fi

  echo "Removing volumes..."
  if ! docker volume rm ${volumes}; then
    echo "Warning: some volumes could not be removed." >&2
  fi
}

remove_networks() {
  local networks
  # get custom network IDs (exclude default bridge/host/none)
  networks="$(docker network ls --format '{{.ID}} {{.Name}}' | awk '$2 != "bridge" && $2 != "host" && $2 != "none" {print $1}')"

  if [[ -z "${networks}" ]]; then
    echo "No custom networks to remove."
    return
  fi

  echo "Removing custom networks..."
  for net in ${networks}; do
    echo "Inspecting network ${net} for connected containers..."
    # list container IDs attached to the network
    containers_on_net=$(docker network inspect -f '{{range $k,$v := .Containers}}{{println $k}}{{end}}' "${net}" 2>/dev/null || true)
    if [[ -n "${containers_on_net}" ]]; then
      echo "Found containers attached to network ${net}; disconnecting..."
      while read -r cid; do
        if [[ -n "${cid}" ]]; then
          echo "Disconnecting container ${cid} from ${net}"
          docker network disconnect -f "${net}" "${cid}" || true
        fi
      done <<< "$containers_on_net"
    fi

    if ! docker network rm "${net}"; then
      echo "Warning: failed to remove network ${net}. It may still have active endpoints." >&2
    fi
  done
}

stop_and_remove_containers
remove_images
remove_volumes
remove_networks

echo "Running docker system prune..."
docker system prune -a --volumes -f >/dev/null || true

echo "Running docker builder prune..."
docker builder prune -a -f >/dev/null || true

echo "Docker cleanup complete."
