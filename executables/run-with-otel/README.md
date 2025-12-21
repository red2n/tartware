# run-with-otel.sh

Launch any workspace with OpenTelemetry exporters preconfigured. Useful for local debugging against the `docker-compose` collector.

## Usage
```bash
./executables/run-with-otel/run-with-otel.sh Apps/api-gateway dev
```
Arguments:
- 1st: workspace path (`Apps/core-service`, etc.)
- 2nd (optional): npm script to run (`dev` by default)

The script sets OTLP endpoints to `http://localhost:4318/v1*` before invoking `npm run <command> --workspace=<workspace>`.
