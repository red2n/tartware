---
name: run-tartware-ui
description: Build, launch, screenshot and drive the Tartware frontends — pms-ui (staff PMS, port 4200) and guest-portal (guest booking, port 4300). Use when asked to run, start, serve, screenshot, or visually verify either UI, to check a theme/dark-mode/design-token change in the real app, or to verify colour contrast and accessibility modes.
---

# Run the Tartware UIs

Two Angular 21 apps live under `UI/`. They share one design-token layer
(`UI/shared-styles/`), so a colour change in one shows up in the other — which
is why one skill covers both.

| App | Port | Needs backend? |
|-----|------|----------------|
| `pms-ui` — staff PMS, PrimeNG | 4200 | **yes**, gateway on 8080 |
| `guest-portal` — guest booking, Angular Material | 4300 | no (layout renders standalone) |

The agent path is **`driver.mjs`** in this directory. `chromium-cli` is *not*
installed in this container; the repo's own Playwright is the browser harness
and the driver wraps it.

All paths below are relative to `UI/` unless stated. Repo root is `..`.

## Prerequisites

Playwright's Chromium needs four system libs that aren't in this image, and
`sudo` wants a password. Don't fight it — fetch the `.deb`s as a normal user
and point the loader at them. This does not touch the system:

```bash
mkdir -p /tmp/pw-libs && cd /tmp/pw-libs
apt-get download libnss3 libnspr4 libasound2t64
for d in *.deb; do dpkg-deb -x "$d" root; done
export LD_LIBRARY_PATH=/tmp/pw-libs/root/usr/lib/x86_64-linux-gnu
```

Verify nothing is still missing (expect `0`):

```bash
ldd ~/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell \
  | grep -c "not found"
```

**`LD_LIBRARY_PATH` must be exported in every shell that runs the driver.**
Forgetting it is the single most common failure; the driver detects it and
tells you.

Browsers themselves were already present. Confirm with:

```bash
ls ~/.cache/ms-playwright/     # expect chromium-1217, chromium_headless_shell-1217
```

## Start the stack

Infra first — Postgres, Redis, Kafka. Idempotent, safe to re-run:

```bash
cd .. && docker compose up -d
```

Backend (10 services; only needed for `pms-ui`). Takes ~30s to be healthy:

```bash
cd .. && nohup pnpm run dev:backend > /tmp/backend.log 2>&1 &
```

Dev servers, one per app:

```bash
cd UI/pms-ui       && nohup npx ng serve --port 4200 > /tmp/pms.log 2>&1 &
cd UI/guest-portal && nohup npx ng serve --port 4300 > /tmp/gp.log 2>&1 &
```

Wait until all three answer. The gateway has no route at `/`, so health-check
`/health` — hitting `/` returns 404 and looks like a failure:

```bash
for p in 4200 4300; do curl -s -o /dev/null -w "$p: %{http_code}\n" http://localhost:$p; done
curl -s -o /dev/null -w "8080/health: %{http_code}\n" http://localhost:8080/health
```

## Run (agent path)

The driver preflights the ports and exits non-zero with a pointer here if
anything is down.

```bash
cd UI
export LD_LIBRARY_PATH=/tmp/pw-libs/root/usr/lib/x86_64-linux-gnu

# screenshots across theme modes
node .claude/skills/run-tartware-ui/driver.mjs shots --modes light,dark --out /tmp/ui-shots

# computed tokens + element styles — catches rules that lost the cascade
node .claude/skills/run-tartware-ui/driver.mjs tokens --modes hc,forced

# exercise the pms-ui three-way theme control (MUTATES DB — see Gotchas)
node .claude/skills/run-tartware-ui/driver.mjs toggle --out /tmp/ui-shots
```

Flags: `--app pms|guest|both` (default `both`), `--modes` from
`light,dark,hc,forced` (default `light,dark`), `--out <dir>` (default
`./ui-shots`).

`hc` is `prefers-contrast: more`; `forced` is `forced-colors: active`
(Windows High Contrast). Login, property selection and waiting are handled
inside the driver.

**Look at the PNGs.** `shots` prints a path per capture. A screenshot that is
blank, or still on `/login`, means the run failed even though the driver exited 0.

### Use `tokens`, not just screenshots, for CSS changes

`tokens` reports *computed* values. It is the only way to catch a rule that
parsed fine and then lost the cascade — a real example from this repo:

```
navBar     0px/3px rgba(5, 0, 73, 0.8)     # forced-colors: rule applied
navBar     0px/2px rgb(15, 77, 133)        # hc: untouched, as intended
```

A `0px` width where you expected a border means your selector lost. See the
encapsulation gotcha below.

## Verify contrast without a browser

Zero-dependency, runs with no `node_modules` and no dev server. 72 pairings
across light, dark and both high-contrast modes:

```bash
cd .. && node UI/shared-styles/check-contrast.mjs
```

Exits non-zero on failure. Run it after touching anything in
`UI/shared-styles/`.

## Build / typecheck

```bash
cd UI/pms-ui       && npx ng build --configuration development
cd UI/guest-portal && npx ng build --configuration development
cd UI/pms-ui       && npx tsc --noEmit -p tsconfig.app.json
```

## Run (human path)

`npx ng serve` in either app, then open `localhost:4200` / `localhost:4300`.
Useless headless — there is no browser in this container except Playwright's.

## Gotchas

Each of these cost real time.

- **`networkidle` never fires on pms-ui.** The dashboard polls, so
  `page.goto(url, { waitUntil: 'networkidle' })` always times out at 30s. Use
  `domcontentloaded` plus an explicit wait. The driver already does.

- **Playwright is CommonJS at its resolved path.** `import { chromium } from
  'playwright'` throws *"Named export 'chromium' not found"*. Use
  `createRequire`. It also resolves to the **repo root** `.pnpm` store, not
  `UI/pms-ui/node_modules` — never hardcode that path, it carries the version
  number and breaks on upgrade.

- **pms-ui ignores the OS theme.** `data-theme` comes from the logged-in
  user's stored preference (`GET /users/me/ui-preferences`), so
  `emulateMedia({ colorScheme: 'dark' })` does *nothing* if that user is set to
  `LIGHT` — you get light screenshots labelled "dark" and conclude dark mode is
  broken. Only `SYSTEM` follows the OS. Either use `driver.mjs toggle`, or set
  the preference directly:

  ```bash
  docker exec tartware-postgres psql -U postgres -d tartware \
    -c "update user_ui_preferences set theme='SYSTEM' where user_id='33333333-3333-3333-3333-333333333333';"
  ```

  **`toggle` leaves this mutated.** Reset with the same statement and `'LIGHT'`.
  guest-portal has no accounts and follows the OS directly, so it needs none of this.

- **Angular view encapsulation beats global CSS.** A component style compiles to
  `.foo[_ngcontent-abc]` — specificity (0,2,0) — which outranks any global
  single-class rule from `UI/shared-styles/`. Rules targeting classes defined in
  `pms-ui/src/styles/shared.scss` (`.badge`, `.card`, `.field-input`) are global
  and win on source order; rules targeting component classes (`.nav-item-active`,
  `.title-bar-motif`) need `!important`. Confirm with `tokens`, not by eye.

- **The sidebar's active marker is a `::before` bar, not a border.** Styling
  `border-inline-start` on `.nav-item-active` silently does nothing.

- **`@primer/primitives` ships no colour.** `primitives.css` is size/type/motion
  only; the colour themes are separate 95 KB files under `functional/themes/`
  that this project deliberately does not load. The palette is entirely
  `UI/shared-styles/`. A missing colour token is *not* a broken install.

- **Gateway `/` returns 404.** Health-check `/health`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `error while loading shared libraries: libnspr4.so` | `LD_LIBRARY_PATH` not exported — redo Prerequisites. |
| `Named export 'chromium' not found` | CommonJS; use `createRequire`. |
| `page.goto: Timeout 30000ms exceeded` waiting on `networkidle` | Switch to `domcontentloaded`. |
| Driver exits 3, `DOWN api-gateway :8080` | Backend not up yet; `tail /tmp/backend.log` and wait ~30s. |
| Screenshots show `/login` | Login failed — creds are `setup.admin` / `TempPass1234`, property `Tartware Beach Resort`. Check the gateway. |
| "dark" screenshots look light | Stored user preference, not a CSS bug. See the theme gotcha. |
| `Cannot load playwright from UI/pms-ui` | Run `pnpm install` at repo root. |

## Stop

```bash
pkill -f "ng serve"; pkill -f "src/index.ts"
```

`src/index.ts` is the only pattern that catches all 10 backend services.
Docker infra keeps running; stop it with `docker compose down` from the repo root.
