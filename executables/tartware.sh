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

# Logging settings: by default show detailed step-by-step command output.
# Override with TARTWARE_QUIET=true to suppress non-essential console output.
# Set TARTWARE_VERBOSE=false to hide live command output (send to .tartware.log only).
TARTWARE_QUIET=${TARTWARE_QUIET:-false}
TARTWARE_VERBOSE=${TARTWARE_VERBOSE:-true}
TARTWARE_LOG_FILE=${TARTWARE_LOG_FILE:-${REPO_ROOT}/.tartware.log}

# Ensure log file exists
mkdir -p "$(dirname "$TARTWARE_LOG_FILE")"
touch "$TARTWARE_LOG_FILE"

log() {
    # primary informational messages; always logged, optionally printed
    echo "[tartware] $*" >> "$TARTWARE_LOG_FILE"
    if [ "${TARTWARE_QUIET}" != "true" ]; then
        printf '%s\n' "[tartware] $*"
    fi
}

# Run a command, capture full output to log file, but show a compact, filtered
# summary to the console. Useful for commands like `docker compose up` which
# emit verbose layer progress lines we want to hide while keeping full logs.
# Usage: run_and_log_filtered "Description" <shell-command-string>
run_and_log_filtered() {
    local desc="$1"; shift
    local cmd="$*"

    printf '\n==> %s START %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$desc" >> "$TARTWARE_LOG_FILE"

    if [ "${TARTWARE_QUIET}" != "true" ]; then
        printf '%s\n' "[tartware] ${desc}..."
    fi

    # Run the command, append full output to the log, but print a filtered
    # summary to stdout (only show Image/Container/Volume/Network status and
    # key keywords like Pulled/Created/Removed/Running/Healthy).
    if bash -c "$cmd" 2>&1 | tee -a "$TARTWARE_LOG_FILE" | awk '/^Container|^Image|^Volume|^Network|Pulled|Created|Removed|Running|Starting|Started|Healthy|\[\+\]/{print}' ; then
        :
    else
        printf '==> %s FAIL %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$desc" >> "$TARTWARE_LOG_FILE"
        printf '%s\n' "[tartware] ERROR: ${desc} failed. See ${TARTWARE_LOG_FILE} for details." >&2
        tail -n 80 "$TARTWARE_LOG_FILE" >&2 || true
        exit 1
    fi

    printf '==> %s SUCCESS %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$desc" >> "$TARTWARE_LOG_FILE"
    if [ "${TARTWARE_QUIET}" != "true" ]; then
        printf '%s\n' "[tartware] ${desc} - done"
    fi
}

fail() {
    echo "[tartware] ERROR: $*" >> "$TARTWARE_LOG_FILE"
    printf '%s\n' "[tartware] ERROR: $*" >&2
    exit 1
}

info() { log "$*"; }
ok() { echo "[tartware] OK: $*" >> "$TARTWARE_LOG_FILE"; [ "${TARTWARE_QUIET}" != "true" ] && printf '%s\n' "[tartware] OK: $*"; }
warn() { echo "[tartware] WARN: $*" >> "$TARTWARE_LOG_FILE"; [ "${TARTWARE_QUIET}" != "true" ] && printf '%s\n' "[tartware] WARN: $*"; }

# Run a command, capture full output to log file, and show concise status to user.
# Usage: run_and_log "Description" <shell-command-string>
run_and_log() {
    local desc="$1"; shift
    local cmd="$*"

    # Header in log
    printf '\n==> %s START %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$desc" >> "$TARTWARE_LOG_FILE"

    if [ "${TARTWARE_QUIET}" != "true" ]; then
        printf '%s\n' "[tartware] ${desc}..."
    fi

    if [ "${TARTWARE_VERBOSE}" = "true" ]; then
        # show live output to console and also append to log
        bash -c "$cmd" 2>&1 | tee -a "$TARTWARE_LOG_FILE"
    else
        # quiet mode: redirect command output to log only
        if bash -c "$cmd" >> "$TARTWARE_LOG_FILE" 2>&1; then
            :
        else
            printf '==> %s FAIL %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$desc" >> "$TARTWARE_LOG_FILE"
            printf '%s\n' "[tartware] ERROR: ${desc} failed. See ${TARTWARE_LOG_FILE} for details." >&2
            tail -n 80 "$TARTWARE_LOG_FILE" >&2 || true
            exit 1
        fi
    fi

    printf '==> %s SUCCESS %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$desc" >> "$TARTWARE_LOG_FILE"
    if [ "${TARTWARE_QUIET}" != "true" ]; then
        printf '%s\n' "[tartware] ${desc} - done"
    fi
}

# Filtered runner for database setup.
# Full output always goes to TARTWARE_LOG_FILE.
# Console gets a noise-filtered view that strips psql idempotent NOTICEs,
# npm warnings, and dotenv injection lines while preserving all status (✓/✗),
# step markers, banners, verification results, and errors.
run_db_setup() {
    local cmd="$*"

    printf '\n==> %s START Database setup\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$TARTWARE_LOG_FILE"

    if [ "${TARTWARE_QUIET}" = "true" ] || [ "${TARTWARE_VERBOSE}" != "true" ]; then
        # Quiet / non-verbose: log only, no console output
        if bash -c "$cmd" >> "$TARTWARE_LOG_FILE" 2>&1; then
            :
        else
            printf '==> %s FAIL Database setup\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$TARTWARE_LOG_FILE"
            printf '%s\n' "[tartware] ERROR: Database setup failed. See ${TARTWARE_LOG_FILE} for details." >&2
            tail -n 80 "$TARTWARE_LOG_FILE" >&2 || true
            exit 1
        fi
    else
        # Verbose: tee full output to log, filter noise for console
        if bash -c "$cmd" 2>&1 \
            | tee -a "$TARTWARE_LOG_FILE" \
            | awk '
                /already exists, skipping$/   { next }
                /does not exist, skipping$/   { next }
                /^npm warn/                   { next }
                /^\[dotenv/                   { next }
                /^Password for user/          { next }
                /^psql:/ { sub(/^psql:[^:]+:[0-9]+: NOTICE:  ?/, "") }
                { print; fflush() }
            '; then
            :
        else
            printf '==> %s FAIL Database setup\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$TARTWARE_LOG_FILE"
            printf '%s\n' "[tartware] ERROR: Database setup failed. See ${TARTWARE_LOG_FILE} for full details." >&2
            exit 1
        fi
    fi

    printf '==> %s SUCCESS Database setup\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$TARTWARE_LOG_FILE"
}

ensure_env_vars() {
    # Ensure critical environment variables exist in .env file
    local env_file="$ENV_FILE_DEFAULT"
    local updated=false

    if [ ! -f "$env_file" ]; then
        log "Creating .env file from template..."
        if [ -f "$ENV_TEMPLATE_DEFAULT" ]; then
            cp "$ENV_TEMPLATE_DEFAULT" "$env_file"
        else
            touch "$env_file"
        fi
    fi

    # Check and add AUTH_JWT_SECRET if missing
    if ! grep -q '^AUTH_JWT_SECRET=' "$env_file" 2>/dev/null; then
        log "Adding AUTH_JWT_SECRET to .env"
        echo "" >> "$env_file"
        echo "# JWT secret for signing tokens (min 32 characters)" >> "$env_file"
        echo "AUTH_JWT_SECRET=dev-secret-minimum-32-chars-change-me!" >> "$env_file"
        updated=true
    fi

    # Check and add AUTH_DEFAULT_PASSWORD if missing
    if ! grep -q '^AUTH_DEFAULT_PASSWORD=' "$env_file" 2>/dev/null; then
        log "Adding AUTH_DEFAULT_PASSWORD to .env"
        echo "" >> "$env_file"
        echo "# Default password for seeded users (min 8 characters)" >> "$env_file"
        echo "AUTH_DEFAULT_PASSWORD=TempPass123" >> "$env_file"
        updated=true
    fi

    if [ "$updated" = true ]; then
        log "Environment variables added to $env_file"
    fi
}

reset_default_passwords() {
    # Reset user passwords to AUTH_DEFAULT_PASSWORD value
    local reset_script="$REPO_ROOT/Apps/core-service/scripts/reset-default-password.ts"
    local default_password="${AUTH_DEFAULT_PASSWORD:-TempPass123}"

    if [ -f "$reset_script" ]; then
        if command -v npx >/dev/null 2>&1; then
            info "Resetting user passwords to default"
            run_and_log "Reset default passwords" "DB_HOST='${DB_HOST:-127.0.0.1}' DB_PORT='${DB_PORT:-5432}' DB_USER='${DB_USER:-postgres}' DB_PASSWORD='${DB_PASSWORD:-postgres}' DB_NAME='${DB_NAME:-tartware}' AUTH_DEFAULT_PASSWORD='${default_password}' NODE_ENV=development npx --yes tsx --tsconfig '$REPO_ROOT/Apps/core-service/tsconfig.json' '$reset_script'"
            ok "Default passwords reset to '${default_password}'"
        else
            warn "npx (Node.js) not installed; skipping password reset. Install Node.js and npm (npx) to enable this step. Script path: $reset_script"
        fi
    else
        warn "Password reset script not found at $reset_script"
    fi
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

# Install NVM for a user and install Node LTS.
# Usage: install_nvm_for_user <username>
install_nvm_for_user() {
    local target_user="$1"
    if [ -z "$target_user" ]; then
        fail "install_nvm_for_user requires a username"
    fi

    # Decide command runner: prefer sudo -u to run as the target user
    local runner="sudo -u '$target_user' -H bash -lc"

    # Check if nvm already available for that user
    if $runner 'command -v nvm >/dev/null 2>&1'; then
        info "nvm already installed for $target_user"
        return 0
    fi

    info "Installing nvm for $target_user"
    run_and_log "Install nvm for $target_user" "$runner 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash'"

    info "Installing Node.js LTS via nvm for $target_user"
    # Source nvm and install LTS; set alias default to lts/*
    run_and_log "Install Node LTS for $target_user" "$runner 'export NVM_DIR=\"\$HOME/.nvm\"; [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\" && nvm install --lts && nvm alias default lts/*'"
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
        db verify   Run verification SQL scripts (verify-installation, verify-setup, tables)

Docker:
    docker up|down|restart|ps|logs|purge|fresh

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

# Short options (convenience):
    -d, -du        Docker up (default)
    -dd            Docker down
    -dr            Docker restart
    -ds            Docker ps
    -dl            Docker logs -f
    -dp            Docker purge (custom purge script)
    -da            Docker purge-all (down -v + system prune)
    -dg            Docker postgres (start only + follow logs)
    -df            Docker fresh (purge ALL system images/containers + start Tartware — requires sudo)

    -e, -ei        Env init
    -er            Env run
    -es            Env show

    -db            DB setup (default)
    -dbv           DB verify

    -devu          Dev UI
    -devo          Dev otel
    -devd          Dev duplo
    -devl          Dev loadtest
    -devg          Dev mfa-generate
    -devs          Dev mfa-show

    -h, --help     Show this help

Examples:
    ./executables/tartware.sh -du          # docker up
    ./executables/tartware.sh -dbs         # db setup
    ./executables/tartware.sh env init --force

        # Environment:
        #   TARTWARE_QUIET=true     # suppress non-essential console output (logs still written to .tartware.log)
        #   TARTWARE_VERBOSE=true   # show live command output (otherwise outputs go to .tartware.log)
USAGE
}

interactive_menu() {
    while true; do
        echo ""
        echo "╔══════════════════════════════════════════════════════════════╗"
        echo "║                   Tartware CLI — Interactive                 ║"
        echo "╠══════════════════════════════════════════════════════════════╣"
        echo "║  1) env      Manage .env file (init, show, run with env)     ║"
        echo "║  2) db       Run database setup and verification             ║"
        echo "║  3) docker   Start, stop, and manage Docker containers       ║"
        echo "║  4) dev      Developer tools (UI, OTel, load test, MFA)      ║"
        echo "║  5) deploy   Deploy to Kubernetes or DuploCloud              ║"
        echo "║  6) retry    Re-run the last tartware command                ║"
        echo "║  0) exit     Quit                                            ║"
        echo "╚══════════════════════════════════════════════════════════════╝"
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
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                  Environment File Helpers                    ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  1) init   Create .env from template (prompts for paths)     ║"
    echo "║  2) show   Print the current .env file path and status       ║"
    echo "║  3) run    Run any shell command with .env variables loaded  ║"
    echo "║  0) back   Return to main menu                               ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
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
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                     Database Helpers                         ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  1) setup    Create tables, enums, indexes, and seed data    ║"
    echo "║  2) verify   Run SQL verification suite (counts, FKs, etc.)  ║"
    echo "║  0) back     Return to main menu                             ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    read -r -p "Select option [0-2]: " choice
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
        2)
            "$EXEC_DIR/tartware.sh" db verify
            ;;
        0) return ;;
        *) echo "Invalid option" ;;
    esac
}

interactive_docker() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                  Docker Compose Helpers                      ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  1) up          Start all Tartware containers (-d)           ║"
    echo "║  2) down        Stop and remove all containers               ║"
    echo "║  3) restart     Down then up in one step                     ║"
    echo "║  4) ps          List running containers and their status     ║"
    echo "║  5) logs        Follow live logs for all containers          ║"
    echo "║  6) purge       Run the custom docker-purge script           ║"
    echo "║  7) purge-all   Down + remove images, volumes, networks      ║"
    echo "║  8) postgres    Start only Postgres and follow its logs      ║"
    echo "║  9) fresh       Purge ALL system images then start Tartware  ║"
    echo "║                 (kills zombie port holders — requires sudo)  ║"
    echo "║  0) back        Return to main menu                          ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    read -r -p "Select option [0-9]: " choice
    case "$choice" in
        1) "$EXEC_DIR/tartware.sh" docker up ;;
        2) "$EXEC_DIR/tartware.sh" docker down ;;
        3) "$EXEC_DIR/tartware.sh" docker restart ;;
        4) "$EXEC_DIR/tartware.sh" docker ps ;;
        5) "$EXEC_DIR/tartware.sh" docker logs ;;
        6) "$EXEC_DIR/tartware.sh" docker purge ;;
        7) "$EXEC_DIR/tartware.sh" docker purge-all ;;
        8) "$EXEC_DIR/tartware.sh" docker postgres ;;
        9) "$EXEC_DIR/tartware.sh" docker fresh ;;
        0) return ;;
        *) echo "Invalid option" ;;
    esac
}

interactive_dev() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                     Developer Tools                          ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  1) ui            Open the Super-Admin UI in a browser       ║"
    echo "║  2) otel          Run an app with OpenTelemetry tracing      ║"
    echo "║  3) duplo         Launch the Duplo local dashboard           ║"
    echo "║  4) loadtest      Run the k6 load test suite                 ║"
    echo "║  5) mfa-generate  Generate TOTP MFA credentials for a user   ║"
    echo "║  6) mfa-show      Show QR code for an existing MFA secret    ║"
    echo "║  0) back          Return to main menu                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
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
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Deployment Helpers                        ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  1) kubernetes   Deploy to a Kubernetes cluster              ║"
    echo "║  2) duplo        Deploy via DuploCloud managed infrastructure║"
    echo "║  0) back         Return to main menu                         ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    read -r -p "Select option [0-2]: " choice
    case "$choice" in
        1) "$EXEC_DIR/tartware.sh" deploy kubernetes ;;
        2) "$EXEC_DIR/tartware.sh" deploy duplo ;;
        0) return ;;
        *) echo "Invalid option" ;;
    esac
}

# Support compact short options like `-du` -> `docker up`.
# If the first argument starts with a single '-', translate it into the full
# command/subcommand and replace positional parameters accordingly. Leave
# long `--` options (e.g. `--help`) untouched so they are handled by the
# normal command dispatch below.
if [ $# -ge 1 ]; then
    if [[ "$1" == --* ]]; then
        # long option passed (e.g. --help) -> leave as-is
        :
    elif [[ "$1" == -?* ]]; then
        short_opt="${1#-}"
        # preserve remaining args
        shift || true

        # Support multi-letter short groups used in usage: `db*` and `dev*`.
        # Check these prefixes first so they don't collide with single-letter
        # groups (e.g., `-db` should map to `db setup`, not `docker b`).
        if [[ "$short_opt" == db* ]]; then
            rest="${short_opt#db}"
            subch="${rest:0:1}"
            case "$subch" in
                v) set -- db verify "$@" ;;   # -dbv
                s) set -- db setup "$@" ;;    # -dbs
                "") set -- db setup "$@" ;;  # -db defaults to setup
                *) fail "Unknown short option: -${short_opt}" ;;
            esac
        elif [[ "$short_opt" == dev* ]]; then
            rest="${short_opt#dev}"
            subch="${rest:0:1}"
            case "$subch" in
                u) set -- dev ui "$@" ;;           # -devu
                o) set -- dev otel "$@" ;;         # -devo
                d) set -- dev duplo "$@" ;;        # -devd
                l) set -- dev loadtest "$@" ;;     # -devl
                g) set -- dev mfa-generate "$@" ;; # -devg
                s) set -- dev mfa-show "$@" ;;     # -devs
                "") set -- dev help "$@" ;;       # -dev defaults to help
                *) fail "Unknown short option: -${short_opt}" ;;
            esac
        else
            case "${short_opt:0:1}" in
                d)
                    # docker group: map second char to subcommands
                    sub="${short_opt:1}"
                    subch="${sub:0:1}"
                    case "$subch" in
                        u) set -- docker up "$@" ;;        # -du
                        d) set -- docker down "$@" ;;      # -dd
                        r) set -- docker restart "$@" ;;   # -dr
                        p) set -- docker purge "$@" ;;     # -dp
                        a) set -- docker purge-all "$@" ;; # -da
                        s) set -- docker ps "$@" ;;        # -ds
                        l) set -- docker logs "$@" ;;      # -dl
                        g) set -- docker postgres "$@" ;;  # -dg (postgres start+logs)
                        f) set -- docker fresh "$@" ;;    # -df (purge all + fresh start)
                        "") set -- docker up "$@" ;;      # -d defaults to up
                        *) fail "Unknown short option: -${short_opt}" ;;
                    esac
                    ;;
                e)
                    # env group: e.g. -ei -> env init (map commonly used)
                    sub="${short_opt:1}"
                    case "${sub:0:1}" in
                        i) set -- env init "$@" ;; # -ei
                        r) set -- env run "$@" ;;  # -er
                        s) set -- env show "$@" ;; # -es
                        "") set -- env show "$@" ;; # -e defaults to show
                        *) fail "Unknown short option: -${short_opt}" ;;
                    esac
                    ;;
                h)
                    # -h -> help
                    set -- help "$@"
                    ;;
                *)
                    fail "Unknown short option group: -${short_opt}"
                    ;;
            esac
        fi
    fi
fi

# Determine command from positional args (after any short-opt translation)
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
            nvm)
                # env nvm install
                sub2="${1:-install}"
                shift || true
                case "$sub2" in
                    install)
                        # Install nvm for the interactive user. If running under sudo,
                        # prefer to install for the original sudo user (SUDO_USER).
                        if [ "$(id -u)" -eq 0 ]; then
                            target_user="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"
                        else
                            target_user="$(id -un)"
                        fi
                        install_nvm_for_user "$target_user"
                        ;;
                    *)
                        fail "Unknown env nvm subcommand: $sub2"
                        ;;
                esac
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
            verify)
                # Ensure env vars exist before verification
                ensure_env_vars
                # Source .env for DB connection values if present
                if [ -f "$ENV_FILE_DEFAULT" ]; then
                    set -a
                    # shellcheck disable=SC1090
                    source "$ENV_FILE_DEFAULT"
                    set +a
                fi
                verify_script="$REPO_ROOT/scripts/tools/run-verifications.sh"
                if [ -f "$verify_script" ]; then
                    run_and_log "Run DB verification" "bash '$verify_script' $*"
                else
                    fail "Missing verification script: $verify_script"
                fi
                exit 0
                ;;

            setup)
                # Ensure env vars exist before setup
                ensure_env_vars
                # Source .env for password value
                if [ -f "$ENV_FILE_DEFAULT" ]; then
                    set -a
                    # shellcheck disable=SC1090
                    source "$ENV_FILE_DEFAULT"
                    set +a
                fi
                setup_script="$EXEC_DIR/setup-database/setup-database.sh"
                if [ ! -f "$setup_script" ]; then
                    fail "Missing setup script: $setup_script"
                fi
                run_db_setup "bash '$setup_script' $*"
                # setup-database.sh already handles password reset internally
                exit 0
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
        # Verify Docker daemon is accessible (catches permission denied on docker socket)
        if ! docker info >/dev/null 2>&1; then
            fail "Cannot connect to Docker daemon. Make sure Docker is running and your user is in the 'docker' group (sudo usermod -aG docker \$USER), then log out and back in. Alternatively, run with sudo."
        fi
        compose_cmd="$(docker_compose_cmd)"
        case "$sub" in
            up)
                # Ensure env vars exist before docker up
                ensure_env_vars
                # Source .env for password value
                if [ -f "$ENV_FILE_DEFAULT" ]; then
                    set -a
                    # shellcheck disable=SC1090
                    source "$ENV_FILE_DEFAULT"
                    set +a
                fi
                run_and_log_filtered "Start Docker Compose" "$compose_cmd -f '$REPO_ROOT/docker-compose.yml' up -d"

                # By default, skip post-setup Node/pnpm tasks during docker up to
                # avoid noisy warnings on machines without Node/npm/pnpm. Set
                # TARTWARE_SKIP_POST_SETUP=false to enable these steps.
                if [ "${TARTWARE_SKIP_POST_SETUP:-true}" != "true" ]; then
                    if command -v pnpm >/dev/null 2>&1; then
                        info "Waiting for Kafka to be ready before bootstrapping topics..."
                        _kafka_broker="${KAFKA_BROKERS:-localhost:29092}"
                        _kafka_host="${_kafka_broker%%:*}"
                        _kafka_port="${_kafka_broker##*:}"
                        _kafka_ready=false
                        for _i in $(seq 1 60); do
                            if nc -z "$_kafka_host" "$_kafka_port" 2>/dev/null; then
                                _kafka_ready=true
                                break
                            fi
                            sleep 1
                        done
                        if [ "$_kafka_ready" = true ]; then
                            run_and_log "Bootstrapping Kafka topics" "cd '$REPO_ROOT' && pnpm run kafka:topics"
                        else
                            warn "Kafka not reachable after 60s — run manually: cd $REPO_ROOT && pnpm run kafka:topics"
                        fi
                    else
                        warn "pnpm not installed; skipping Kafka bootstrap. Install pnpm to run 'pnpm run kafka:topics' or run it manually: cd $REPO_ROOT && pnpm run kafka:topics"
                    fi

                    if command -v node >/dev/null 2>&1; then
                        run_and_log "Seeding default data" "DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=tartware node '$REPO_ROOT/scripts/data/defaults/seed-default-data.mjs'"
                    else
                        warn "node not installed; skipping default data seeding. Install Node.js to run seed script: $REPO_ROOT/scripts/data/defaults/seed-default-data.mjs"
                    fi

                    reset_default_passwords
                else
                    info "Skipping post-setup tasks (Kafka bootstrap, data seeding, password reset). Set TARTWARE_SKIP_POST_SETUP=false to enable."
                fi
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
            purge-all)
                # Full tear-down and prune of Docker resources (images, volumes, networks)
                run_and_log_filtered "Tear down Docker Compose and remove images" "$compose_cmd -f '$REPO_ROOT/docker-compose.yml' down -v --rmi all --remove-orphans"
                run_and_log_filtered "Prune Docker system" "docker system prune -a --volumes -f"
                ;;
            fresh)
                # Purge ALL system Docker images/containers/volumes/networks, then start Tartware
                if [ "$(id -u)" -ne 0 ]; then
                    fail "docker fresh requires root. Re-run: sudo ${EXEC_DIR}/tartware.sh docker fresh"
                fi
                info "Purging ALL Docker containers and images from the system..."
                run_and_log "Stop all running containers" "docker stop \$(docker ps -aq 2>/dev/null) 2>/dev/null || true"
                run_and_log "Remove all containers" "docker rm -f \$(docker ps -aq 2>/dev/null) 2>/dev/null || true"
                run_and_log "Remove all images" "docker rmi -f \$(docker images -aq 2>/dev/null) 2>/dev/null || true"
                run_and_log_filtered "Prune Docker system (volumes, networks, build cache)" "docker system prune -af --volumes"
                run_and_log "Prune Docker networks" "docker network prune -f"
                run_and_log "Kill zombie docker-proxy processes" "pkill -9 docker-proxy 2>/dev/null || true"
                ok "System fully purged."
                info "Starting Tartware containers..."
                ensure_env_vars
                if [ -f "$ENV_FILE_DEFAULT" ]; then
                    set -a
                    # shellcheck disable=SC1090
                    source "$ENV_FILE_DEFAULT"
                    set +a
                fi
                run_and_log_filtered "Start Docker Compose" "$compose_cmd -f '$REPO_ROOT/docker-compose.yml' up -d"
                ;;
            postgres)
                # Start only postgres and follow logs
                run_and_log_filtered "Start Postgres" "$compose_cmd -f '$REPO_ROOT/docker-compose.yml' up -d postgres"
                run_and_log "Follow Postgres logs" "$compose_cmd -f '$REPO_ROOT/docker-compose.yml' logs -f postgres"
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
