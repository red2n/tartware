#!/usr/bin/env bash
# ============================================================================
# Tartware - Unified CLI entrypoint for dev and deployment workflows
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
EXEC_DIR="${REPO_ROOT}/executables"
ENV_FILE_DEFAULT="${REPO_ROOT}/.env"
ENV_TEMPLATE_DEFAULT="${REPO_ROOT}/.env.example"
LAST_CMD_FILE="${REPO_ROOT}/.tartware-last-command"

log() {
    echo "[tartware] $*"
}

fail() {
    echo "[tartware] ERROR: $*" >&2
    exit 1
}

record_last_cmd() {
    printf '%q ' "$EXEC_DIR/tartware.sh" "$@" > "$LAST_CMD_FILE"
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

docker_compose_cmd() {
    if docker compose version >/dev/null 2>&1; then
        echo "docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        echo "docker-compose"
    else
        fail "Docker Compose not found (install docker compose or docker-compose)."
    fi
}

usage() {
    cat <<'USAGE'
Tartware CLI

Usage:
  ./executables/tartware.sh <command> [subcommand] [options]
  ./executables/tartware.sh              # interactive mode

Commands:
  env      Environment file helpers
  db       Database setup helpers
  docker   Docker compose helpers
  dev      Developer helpers
  deploy   Deployment helpers
  help     Show this help
  exit     Exit immediately
  retry    Re-run the last tartware command
  interactive  Launch interactive mode

Env:
  env init [--template PATH] [--output PATH] [--force]
  env run -- <command>
  env show

DB:
  db setup [--mode=direct|docker] [extra setup-database args]

Docker:
  docker up|down|restart|ps|logs|purge

Dev:
  dev ui
  dev otel <app> <command>
  dev duplo
  dev loadtest
  dev mfa-generate
  dev mfa-show

Deploy:
  deploy kubernetes
  deploy duplo
USAGE
}

interactive_menu() {
    while true; do
        echo ""
        echo "Tartware CLI - Interactive"
        echo "1) env"
        echo "2) db"
        echo "3) docker"
        echo "4) dev"
        echo "5) deploy"
        echo "6) retry"
        echo "0) exit"
        echo ""
        read -r -p "Select option [0-6]: " choice
        case "$choice" in
            1) interactive_env ;;
            2) interactive_db ;;
            3) interactive_docker ;;
            4) interactive_dev ;;
            5) interactive_deploy ;;
            6) "$EXEC_DIR/tartware.sh" retry ;;
            0) exit 0 ;;
            *) echo "Invalid option" ;;
        esac
    done
}

interactive_env() {
    echo ""
    echo "Env"
    echo "1) init"
    echo "2) show"
    echo "3) run"
    echo "0) back"
    read -r -p "Select option [0-3]: " choice
    case "$choice" in
        1)
            read -r -p "Template path (enter for default): " template
            read -r -p "Output path (enter for default): " output
            read -r -p "Force overwrite? (y/N): " force
            args=()
            [ -n "$template" ] && args+=(--template "$template")
            [ -n "$output" ] && args+=(--output "$output")
            if [ "${force:-}" = "y" ] || [ "${force:-}" = "Y" ]; then
                args+=(--force)
            fi
            "$EXEC_DIR/tartware.sh" env init "${args[@]}"
            ;;
        2)
            "$EXEC_DIR/tartware.sh" env show
            ;;
        3)
            read -r -p "Command to run with env: " env_cmd
            if [ -n "$env_cmd" ]; then
                # shellcheck disable=SC2086
                eval "$EXEC_DIR/tartware.sh env run -- $env_cmd"
            fi
            ;;
        0) return ;;
        *) echo "Invalid option" ;;
    esac
}

interactive_db() {
    echo ""
    echo "DB"
    echo "1) setup"
    echo "0) back"
    read -r -p "Select option [0-1]: " choice
    case "$choice" in
        1)
            read -r -p "Mode (direct/docker) [direct]: " mode
            mode="${mode:-direct}"
            read -r -p "Extra args (optional): " extra
            extra_args=()
            if [ -n "$extra" ]; then
                # shellcheck disable=SC2206
                extra_args=($extra)
            fi
            "$EXEC_DIR/tartware.sh" db setup --mode="$mode" "${extra_args[@]}"
            ;;
        0) return ;;
        *) echo "Invalid option" ;;
    esac
}

interactive_docker() {
    echo ""
    echo "Docker"
    echo "1) up"
    echo "2) down"
    echo "3) restart"
    echo "4) ps"
    echo "5) logs"
    echo "6) purge"
    echo "0) back"
    read -r -p "Select option [0-6]: " choice
    case "$choice" in
        1) "$EXEC_DIR/tartware.sh" docker up ;;
        2) "$EXEC_DIR/tartware.sh" docker down ;;
        3) "$EXEC_DIR/tartware.sh" docker restart ;;
        4) "$EXEC_DIR/tartware.sh" docker ps ;;
        5) "$EXEC_DIR/tartware.sh" docker logs ;;
        6) "$EXEC_DIR/tartware.sh" docker purge ;;
        0) return ;;
        *) echo "Invalid option" ;;
    esac
}

interactive_dev() {
    echo ""
    echo "Dev"
    echo "1) ui"
    echo "2) otel"
    echo "3) duplo"
    echo "4) loadtest"
    echo "5) mfa-generate"
    echo "6) mfa-show"
    echo "0) back"
    read -r -p "Select option [0-6]: " choice
    case "$choice" in
        1) "$EXEC_DIR/tartware.sh" dev ui ;;
        2)
            read -r -p "App name: " app
            read -r -p "Command (e.g. dev|start): " app_cmd
            if [ -n "$app" ] && [ -n "$app_cmd" ]; then
                "$EXEC_DIR/tartware.sh" dev otel "$app" "$app_cmd"
            fi
            ;;
        3) "$EXEC_DIR/tartware.sh" dev duplo ;;
        4) "$EXEC_DIR/tartware.sh" dev loadtest ;;
        5) "$EXEC_DIR/tartware.sh" dev mfa-generate ;;
        6) "$EXEC_DIR/tartware.sh" dev mfa-show ;;
        0) return ;;
        *) echo "Invalid option" ;;
    esac
}

interactive_deploy() {
    echo ""
    echo "Deploy"
    echo "1) kubernetes"
    echo "2) duplo"
    echo "0) back"
    read -r -p "Select option [0-2]: " choice
    case "$choice" in
        1) "$EXEC_DIR/tartware.sh" deploy kubernetes ;;
        2) "$EXEC_DIR/tartware.sh" deploy duplo ;;
        0) return ;;
        *) echo "Invalid option" ;;
    esac
}

if [ $# -eq 0 ]; then
    cmd="interactive"
else
    cmd="$1"
    shift || true
fi

if [ "$cmd" != "help" ] && [ "$cmd" != "exit" ] && [ "$cmd" != "retry" ]; then
    record_last_cmd "$cmd" "$@"
fi

case "$cmd" in
    help|-h|--help)
        usage
        ;;

    exit)
        exit 0
        ;;

    retry)
        if [ ! -f "$LAST_CMD_FILE" ]; then
            fail "No previous command recorded."
        fi
        last_cmd="$(cat "$LAST_CMD_FILE")"
        log "Retrying: $last_cmd"
        eval "$last_cmd"
        ;;

    interactive)
        interactive_menu
        ;;

    env)
        sub="${1:-show}"
        shift || true
        case "$sub" in
            init)
                template="$ENV_TEMPLATE_DEFAULT"
                output="$ENV_FILE_DEFAULT"
                force=false
                while [ $# -gt 0 ]; do
                    case "$1" in
                        --template=*) template="${1#*=}" ;;
                        --template) template="$2"; shift ;;
                        --output=*) output="${1#*=}" ;;
                        --output) output="$2"; shift ;;
                        --force) force=true ;;
                        *) fail "Unknown option for env init: $1" ;;
                    esac
                    shift
                done
                if [ ! -f "$template" ]; then
                    fail "Template not found: $template"
                fi
                if [ -f "$output" ] && [ "$force" = false ]; then
                    fail "Env file already exists: $output (use --force to overwrite)"
                fi
                cp "$template" "$output"
                log "Env file created: $output"
                ;;
            run)
                env_file="$ENV_FILE_DEFAULT"
                if [ ! -f "$env_file" ]; then
                    fail "Env file not found: $env_file (run 'env init' first)"
                fi
                if [ $# -eq 0 ]; then
                    fail "No command provided. Usage: env run -- <command>"
                fi
                if [ "$1" = "--" ]; then
                    shift
                fi
                if [ $# -eq 0 ]; then
                    fail "No command provided after --"
                fi
                set -a
                # shellcheck disable=SC1090
                source "$env_file"
                set +a
                exec "$@"
                ;;
            show)
                if [ -f "$ENV_FILE_DEFAULT" ]; then
                    log "Env file: $ENV_FILE_DEFAULT"
                else
                    log "Env file not found: $ENV_FILE_DEFAULT"
                fi
                ;;
            *)
                fail "Unknown env subcommand: $sub"
                ;;
        esac
        ;;

    db)
        sub="${1:-setup}"
        shift || true
        case "$sub" in
            setup)
                setup_script="$EXEC_DIR/setup-database/setup-database.sh"
                if [ ! -x "$setup_script" ]; then
                    fail "Missing setup script: $setup_script"
                fi
                exec "$setup_script" "$@"
                ;;
            *)
                fail "Unknown db subcommand: $sub"
                ;;
        esac
        ;;

    docker)
        sub="${1:-up}"
        shift || true
        require_cmd docker
        compose_cmd="$(docker_compose_cmd)"
        case "$sub" in
            up)
                $compose_cmd -f "$REPO_ROOT/docker-compose.yml" up -d
                ;;
            down)
                $compose_cmd -f "$REPO_ROOT/docker-compose.yml" down
                ;;
            restart)
                $compose_cmd -f "$REPO_ROOT/docker-compose.yml" down
                $compose_cmd -f "$REPO_ROOT/docker-compose.yml" up -d
                ;;
            ps)
                $compose_cmd -f "$REPO_ROOT/docker-compose.yml" ps
                ;;
            logs)
                $compose_cmd -f "$REPO_ROOT/docker-compose.yml" logs -f
                ;;
            purge)
                exec "$EXEC_DIR/docker-purge/docker-purge.sh" "$@"
                ;;
            *)
                fail "Unknown docker subcommand: $sub"
                ;;
        esac
        ;;

    dev)
        sub="${1:-help}"
        shift || true
        case "$sub" in
            ui)
                exec "$EXEC_DIR/run-super-admin-ui/index.sh" "$@"
                ;;
            otel)
                exec "$EXEC_DIR/run-with-otel/run-with-otel.sh" "$@"
                ;;
            duplo)
                exec "$EXEC_DIR/run-duplo/run-duplo.sh" "$@"
                ;;
            loadtest)
                exec "$EXEC_DIR/run-load-test/run-load-test.sh" "$@"
                ;;
            mfa-generate)
                exec "$EXEC_DIR/generate-credentials/generate-credentials.sh" "$@"
                ;;
            mfa-show)
                exec "$EXEC_DIR/show-mfa-qr/show-mfa-qr.sh" "$@"
                ;;
            help|*)
                usage
                ;;
        esac
        ;;

    deploy)
        sub="${1:-help}"
        shift || true
        case "$sub" in
            kubernetes)
                exec "$EXEC_DIR/setup-kubernetes/setup-kubernetes.sh" "$@"
                ;;
            duplo)
                exec "$EXEC_DIR/setup-duplo/setup-duplo.sh" "$@"
                ;;
            help|*)
                usage
                ;;
        esac
        ;;

    *)
        fail "Unknown command: $cmd (use help)"
        ;;
esac
