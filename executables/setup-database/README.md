# setup-database.sh

Bootstraps the Tartware PostgreSQL schema (extensions, tables, indexes, constraints, triggers) either against a local instance or the dockerized stack.

## Usage
```bash
./executables/setup-database/setup-database.sh --mode=direct   # or --mode=docker
```

The script prompts before dropping existing databases, runs every SQL pack under `scripts/`, loads seed data, and performs verification queries so you start from a clean, consistent state.
