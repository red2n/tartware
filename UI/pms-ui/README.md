# PmsUi

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

End-to-end tests use [Playwright](https://playwright.dev/) with Chromium to smoke-test all UI screens.

### Prerequisites

1. **Install Playwright browsers** (one-time):

   ```bash
   npx playwright install chromium
   ```

2. **Install system dependencies** (Linux — requires sudo):

   ```bash
   sudo npx playwright install-deps chromium
   ```

   > If `sudo: npx: command not found`, use the full path:
   > ```bash
   > sudo $(which npx) playwright install-deps chromium
   > ```

3. **Start the dev server** (must be running on `localhost:4200`):

   ```bash
   pnpm start
   ```

4. **Start the backend** (must be running on `localhost:8080`):

   ```bash
   # from the repo root
   pnpm run dev:backend
   ```

### Running tests

```bash
# Headed (visible browser) — default
pnpm e2e

# Headless (CI / background)
pnpm e2e:headless

# Playwright interactive UI mode
pnpm e2e:ui
```

### What the tests cover

The smoke suite (`e2e/smoke.spec.ts`) visits 22 screens and asserts:

- No full-page error state
- No leftover loading spinners
- At least one heading is visible

Screens tested: Dashboard, Reservations, Group Bookings, Guests, Rooms, Room Types, Buildings, Rates, Rate Calendar, Packages, Housekeeping, Billing, Accounts Receivable, Cashiering, Night Audit, Tax Configuration, Invoices, Commissions, Settings, Command Management, User Management, Screen Permissions.

### Authentication

The test suite uses a setup project (`e2e/auth.setup.ts`) that logs in once with `setup.admin` / `TempPass123`, selects "Tartware Beach Resort", and saves the browser state to `e2e/.auth/state.json`. All screen tests reuse this saved session.

### Test artifacts

On failure, Playwright captures screenshots, videos, and traces in `test-results/`. View a trace with:

```bash
npx playwright show-trace test-results/<test-folder>/trace.zip
```

View the HTML report:

```bash
npx playwright show-report
```

## Docker Deployment

### Local Build & Deploy

Build, purge old container/image, and deploy fresh to local Docker:

```bash
# From repository root
pnpm run build:ui && \
cd UI/pms-ui && \
sudo docker rm -f tartware-pms-ui 2>/dev/null; \
sudo docker rmi -f tartware-pms-ui 2>/dev/null; \
sudo docker build --no-cache -t tartware-pms-ui . && \
sudo docker run -d --name tartware-pms-ui --add-host=host.docker.internal:host-gateway -p 80:80 tartware-pms-ui
```

Access at `http://localhost`. The nginx config proxies `/v1/` requests to the backend on `host.docker.internal:8080`.

### Build, Push to GHCR & Deploy

Prerequisites — log in to GitHub Container Registry (one-time):

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u red2n --password-stdin
```

```bash
# 1. Build schemas + Angular production bundle (from repo root)
pnpm run build:ui && \

# 2. Build Docker image & push to GHCR
cd UI/pms-ui && \
docker build -t ghcr.io/red2n/tartware-pms-ui:latest . && \
docker push ghcr.io/red2n/tartware-pms-ui:latest && \

# 3. Pull from GHCR & deploy locally
docker pull ghcr.io/red2n/tartware-pms-ui:latest && \
docker rm -f tartware-pms-ui 2>/dev/null; \
docker run -d \
  --name tartware-pms-ui \
  --add-host=host.docker.internal:host-gateway \
  -p 80:80 \
  --restart unless-stopped \
  ghcr.io/red2n/tartware-pms-ui:latest
```

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
