#!/usr/bin/env bash
###############################################################################
# ensure-deps.sh — prerequisite installer shared by the test-accounts-realdata
# suite.
#
# Sourced, never executed. Each test script declares the external commands it
# needs and anything missing is installed with the platform's package manager:
#
#   source "$SCRIPT_DIR/ensure-deps.sh"
#   ensure_deps jq bc curl
#
# When everything is already present this is a handful of `command -v` calls
# and prints nothing, so the normal path costs nothing.
#
# Installing reaches outside the repo and generally needs sudo, so it asks
# first. Two env vars override the prompt:
#
#   TARTWARE_AUTO_INSTALL_DEPS=1   install without asking (CI, fresh containers)
#   TARTWARE_AUTO_INSTALL_DEPS=0   never install — report and exit non-zero
#
# With no terminal to prompt on and no override set it exits instead of running
# sudo unattended, printing the exact command to run by hand.
#
# Package managers: apt-get, dnf, yum, zypper, pacman, apk, brew. On anything
# else it reports what is missing and exits — the same outcome as the hard-coded
# `command -v … || exit 1` checks this replaced, just with a usable message.
###############################################################################

# Sourced by three scripts that may one day source each other; only define once.
if [[ -n "${_TARTWARE_DEPS_SOURCED:-}" ]]; then
  return 0
fi
_TARTWARE_DEPS_SOURCED=1

# Set by ensure_deps once the manager is known: "sudo" or empty.
_DEPS_SUDO=""

# ─── Platform detection ──────────────────────────────────────────────────────

_deps_pkg_manager() {
  # Homebrew wins on macOS only. Elsewhere a Linuxbrew install should not
  # outrank the distro's own manager, which is what actually owns /usr/bin.
  if [[ "${OSTYPE:-}" == darwin* ]] && command -v brew >/dev/null 2>&1; then
    echo "brew"; return 0
  fi
  local m
  for m in apt-get dnf yum zypper pacman apk brew; do
    if command -v "$m" >/dev/null 2>&1; then echo "$m"; return 0; fi
  done
  return 1
}

# Command name → package name. jq, bc and curl are named identically across
# every supported manager; psql is the only one that moves around.
_deps_pkg_name() {
  local mgr="$1" tool="$2"
  case "$tool" in
    psql)
      case "$mgr" in
        apt-get|apk) echo "postgresql-client" ;;
        brew)        echo "libpq" ;;
        *)           echo "postgresql" ;;
      esac
      ;;
    *) echo "$tool" ;;
  esac
}

# The command as a user would type it — printed before running, and printed
# on its own when we decline to run it for them.
_deps_install_hint() {
  local mgr="$1"; shift
  case "$mgr" in
    apt-get) echo "${_DEPS_SUDO:+$_DEPS_SUDO }apt-get update && ${_DEPS_SUDO:+$_DEPS_SUDO }apt-get install -y $*" ;;
    dnf)     echo "${_DEPS_SUDO:+$_DEPS_SUDO }dnf install -y $*" ;;
    yum)     echo "${_DEPS_SUDO:+$_DEPS_SUDO }yum install -y $*" ;;
    zypper)  echo "${_DEPS_SUDO:+$_DEPS_SUDO }zypper --non-interactive install $*" ;;
    pacman)  echo "${_DEPS_SUDO:+$_DEPS_SUDO }pacman -Sy --noconfirm $*" ;;
    apk)     echo "${_DEPS_SUDO:+$_DEPS_SUDO }apk add --no-cache $*" ;;
    brew)    echo "brew install $*" ;;
  esac
}

_deps_install() {
  local mgr="$1"; shift
  case "$mgr" in
    apt-get)
      # Container images ship with a stale or empty package index, and the
      # install fails confusingly without this. Only runs when something is
      # actually missing, so the cost lands on first run alone.
      $_DEPS_SUDO apt-get update -qq
      $_DEPS_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
      ;;
    dnf)     $_DEPS_SUDO dnf install -y "$@" ;;
    yum)     $_DEPS_SUDO yum install -y "$@" ;;
    zypper)  $_DEPS_SUDO zypper --non-interactive install "$@" ;;
    pacman)  $_DEPS_SUDO pacman -Sy --noconfirm "$@" ;;
    apk)     $_DEPS_SUDO apk add --no-cache "$@" ;;
    brew)    brew install "$@" ;;   # brew refuses to run under sudo
  esac
}

# ─── Entry point ─────────────────────────────────────────────────────────────

# ensure_deps <command>...
# Returns 0 with every command present; otherwise installs or exits 1.
ensure_deps() {
  local tool
  local missing=()

  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
  done
  [[ ${#missing[@]} -eq 0 ]] && return 0

  echo "  ⚠ Missing prerequisite(s): ${missing[*]}"

  local mgr=""
  mgr=$(_deps_pkg_manager || true)
  if [[ -z "$mgr" ]]; then
    echo "FATAL: no supported package manager found (apt-get, dnf, yum, zypper, pacman, apk, brew)."
    echo "       Install these by hand and re-run: ${missing[*]}"
    return 1
  fi

  # brew installs into its own prefix and refuses to run under sudo.
  _DEPS_SUDO=""
  if [[ "$mgr" != "brew" && "$(id -u)" -ne 0 ]]; then
    if command -v sudo >/dev/null 2>&1; then
      _DEPS_SUDO="sudo"
    else
      echo "FATAL: need root to install ${missing[*]} via $mgr, and sudo is not available."
      echo "       Install these by hand and re-run: ${missing[*]}"
      return 1
    fi
  fi

  local pkgs=()
  for tool in "${missing[@]}"; do
    pkgs+=("$(_deps_pkg_name "$mgr" "$tool")")
  done

  local hint
  hint=$(_deps_install_hint "$mgr" "${pkgs[@]}")

  # ── Decide whether to go ahead ──
  local auto="${TARTWARE_AUTO_INSTALL_DEPS:-}"
  case "$auto" in
    0|no|false)
      echo "FATAL: TARTWARE_AUTO_INSTALL_DEPS=$auto — refusing to install."
      echo "       Run: $hint"
      return 1
      ;;
    1|yes|true)
      echo "  → TARTWARE_AUTO_INSTALL_DEPS=$auto, installing without prompting"
      ;;
    *)
      # Prompt on /dev/tty rather than stdin: these scripts get piped to tee
      # and run under CI, where stdin is not the terminal.
      if [[ -e /dev/tty ]] && { : >/dev/tty; } 2>/dev/null; then
        local reply=""
        echo "  This will run: $hint"
        read -r -p "  Install now? [Y/n] " reply </dev/tty || reply=""
        case "$reply" in
          [Nn]*)
            echo "FATAL: prerequisites declined."
            echo "       Run: $hint"
            return 1
            ;;
        esac
      else
        echo "FATAL: prerequisites missing and no terminal to confirm on."
        echo "       Run: $hint"
        echo "       …or re-run with TARTWARE_AUTO_INSTALL_DEPS=1 to install unattended."
        return 1
      fi
      ;;
  esac

  echo "  Installing: ${pkgs[*]}"
  if ! _deps_install "$mgr" "${pkgs[@]}"; then
    echo "FATAL: install failed."
    echo "       Run: $hint"
    return 1
  fi

  # bash caches command lookups; without this a freshly installed binary is
  # still "not found" for the rest of this shell.
  hash -r 2>/dev/null || true

  local still=()
  for tool in "${missing[@]}"; do
    command -v "$tool" >/dev/null 2>&1 || still+=("$tool")
  done
  if [[ ${#still[@]} -gt 0 ]]; then
    echo "FATAL: installed but still not on PATH: ${still[*]}"
    if [[ "$mgr" == "brew" ]]; then
      # libpq is keg-only — brew deliberately leaves psql off PATH so it
      # cannot shadow a system postgres.
      echo "       Homebrew keeps libpq keg-only. Add it to PATH:"
      echo "         export PATH=\"\$(brew --prefix libpq)/bin:\$PATH\""
    fi
    return 1
  fi

  echo "  ✓ Installed: ${missing[*]}"
  return 0
}
