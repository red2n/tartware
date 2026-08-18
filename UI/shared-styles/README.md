# Shared design tokens

The single source of colour and shape for **both** UI apps — `pms-ui` (staff)
and `guest-portal` (guests). Neither app owns these files. Change a value here
and both apps move together; that is the point.

This file is the spec the palette headers cite. It defines the naming grammar,
the complete token set, which foreground may sit on which background, and the
contrast floor each pairing must hold.

```
UI/shared-styles/
  palette-light.css    semantic colour, light theme
  palette-dark.css     semantic colour, dark theme
  shape.css            border radius + bold weight
  contrast.css         prefers-contrast and forced-colors
  check-contrast.mjs   the regression guard (run it, see below)
```

## The rule

**Never write a raw colour in an app.** No hex, no `rgb()`, no named colours in
any component `.scss` file or inline `styles:` block. If you need a colour, it
is one of the tokens below. If none of them fit, the right move is almost
always to reconsider — a genuinely new semantic role is rare, and adding one
means adding it to both palettes and to `check-contrast.mjs`.

Both apps are currently at **zero** hardcoded colour values. Keep it there.

## Cascade order

Every layer keys off one attribute, `data-theme` on `<html>`, written only by
`ThemeService` (pms-ui) or the pre-bootstrap script (guest-portal).

| # | Layer | Source | Selector |
|---|-------|--------|----------|
| 0 | Size, type, motion scales | `@primer/primitives` | `:root` |
| 1 | Shape overrides | `shape.css` | `:root` |
| 2 | Palette | `palette-light.css` / `palette-dark.css` | `[data-theme="…"]` |
| 3 | App-specific tokens | each app's own `tokens.css` | `:root` |
| 4 | Accessibility overrides | `contrast.css` | `[data-theme="…"]` in `@media` |

Layers 1–4 are all specificity (0,1,0), so **source order decides**. Import
them in the order above or the palette will lose to the base scale.

Primer's `primitives.css` deliberately ships **no colour** — it is the size,
type and motion entry point only. Primer's own colour themes exist at
`functional/themes/*.css` but we do not load them: each is 95 KB defining 1800
tokens, of which this product uses roughly 47.

## Naming grammar

A token name is derived, not invented. If you cannot build the name from this
grammar, the token probably should not exist.

```
--<property>Color-<role>[-<weight>]
```

| Part | Values | Meaning |
|------|--------|---------|
| `property` | `fg` · `bg` · `border` | What the colour is applied to: text and icons, fills, or edges |
| `role` | `default` · `muted` · `emphasis` · `inset` · `onEmphasis` · `control` · `translucent` · `accent` · `success` · `danger` · `attention` · `done` · `open` · `neutral` | The semantic job, never the hue |
| `weight` | `emphasis` · `muted` | Only on the status and accent roles. `emphasis` is a **solid fill that carries `--fgColor-onEmphasis`**; `muted` is a **tinted wash that carries `--fgColor-<same role>`** |

Component tokens, where a specific control needs its own value, extend the same
grammar with the component first and the interaction state last:

```
--<component>[-<variant>]-<property>Color-<state>
```

e.g. `--button-primary-bgColor-hover`, `--control-transparent-bgColor-hover`.

**Semantic, never literal.** `--fgColor-danger` is "text that means something
went wrong", not "red". A token named for its hue cannot survive a theme
change, which is the whole reason the layer exists.

Four names sit outside the grammar because they are not semantic colour roles:
`--accent-decorative`, `--overlay-bgColor`, `--overlay-backdrop-bgColor`, and
the `--shadow-*` set.

## The token set

48 tokens, and **both palettes define all 48** — the guard fails the build if
one theme is missing a name the other has. A token absent from one theme does
not fall back to something sensible; the declaration using it is dropped, which
renders as an invisible border or unstyled text rather than an error.

**Surfaces** `--bgColor-default` (the page) · `--bgColor-muted` (panels, cards,
sidebars) · `--bgColor-inset` (wells) · `--bgColor-emphasis` (high-contrast
surface, always dark)

**Text** `--fgColor-default` · `--fgColor-muted` (secondary) ·
`--fgColor-onEmphasis` (on any `-emphasis` fill) · `--fgColor-accent` (links)

**Accent** `--fgColor-accent` · `--bgColor-accent-emphasis` ·
`--bgColor-accent-muted` · `--borderColor-accent-emphasis` (focus rings) ·
`--borderColor-accent-muted` · `--accent-decorative`

**Status** `--fgColor-success` · `--fgColor-danger` · `--fgColor-attention` ·
`--fgColor-done` · `--fgColor-open`, each with a `--bgColor-<role>-emphasis`
fill and a `--bgColor-<role>-muted` wash, plus `--bgColor-neutral-muted`

**Borders** `--borderColor-default` (decorative separators only — it is 1.3:1
and deliberately so) · `--borderColor-control` (**use this on anything a user
operates**; it is the one that clears the 3:1 WCAG 1.4.11 boundary rule) ·
`--borderColor-muted` · `--borderColor-translucent` · plus
`--borderColor-<status>-muted` outlines

**Actions** `--button-primary-bgColor-rest` / `-hover` / `-active` ·
`--button-primary-borderColor-rest` · `--control-transparent-bgColor-hover`

**Chrome** `--overlay-bgColor` · `--overlay-backdrop-bgColor` ·
`--shadow-resting-small` / `-medium` · `--shadow-floating-medium` / `-large`

## The pairing contract

This is the part that makes the tokens a system rather than a list. Every
combination below is checked by the guard, in both themes and both contrast
modes — 97 assertions in total.

| Foreground | May sit on | Floor | WCAG |
|---|---|---:|---|
| `--fgColor-default` | `--bgColor-default`, `--bgColor-muted` | 4.5 | 1.4.3 |
| `--fgColor-muted` | `--bgColor-default`, `--bgColor-muted` | 4.5 | 1.4.3 |
| `--fgColor-accent` | `--bgColor-default`, `--bgColor-muted`, `--bgColor-accent-muted` | 4.5 | 1.4.3 |
| `--fgColor-<status>` | `--bgColor-default`, `--bgColor-<same status>-muted` | 4.5 | 1.4.3 |
| `--fgColor-onEmphasis` | `--bgColor-emphasis`, `--bgColor-accent-emphasis`, `--button-primary-bgColor-*` | 4.5 | 1.4.3 |
| `--borderColor-control` | `--bgColor-default`, `--bgColor-muted` | 3.0 | 1.4.11 |
| `--borderColor-accent-emphasis` | `--bgColor-default` | 3.0 | 1.4.11 |

Under `prefers-contrast: more` every text floor rises to 7:1 and every boundary
floor to 4.5:1. `contrast.css` supplies the stronger values.

**The two rules that follow from the weight vocabulary**, and the ones most
often got wrong:

- An `-emphasis` fill carries **`--fgColor-onEmphasis`** and nothing else.
- A `-muted` wash carries **`--fgColor-<its own role>`** — never
  `--fgColor-default`. `.badge-success` is `--bgColor-success-muted` +
  `--fgColor-success`; putting default text on a status wash is off-contract
  and unchecked.

### Three traps worth naming

`--borderColor-default` is **not** good enough for an input. It is 1.31:1 on
white — fine for a rule between table rows, invisible as a control boundary.
Inputs, checkboxes and anything else operable take `--borderColor-control`.

`--accent-decorative` (`#2081e2`, the showcase blue) is only 3.96:1 and **must
never carry text or sit behind a white label**. It exists for glows, gradients
and washes. The blue that text uses is `--fgColor-accent`.

**Check text against the panel as well as the page.** Most forms sit on
`--bgColor-muted`, and that is where borderline values fail — it is exactly how
`--borderColor-control` slipped through at 2.96:1 and how `--fgColor-muted`
slipped through at 4.44:1.

## Contrast floors

From WCAG 2.2. The guard enforces all of these.

| Context | Normal | `prefers-contrast: more` |
|---------|-------:|-------------------------:|
| Body text (1.4.3 / 1.4.6) | 4.5:1 | 7:1 |
| Control boundary, focus ring (1.4.11) | 3:1 | 4.5:1 |

## The guard

```bash
node UI/shared-styles/check-contrast.mjs   # or: pnpm run check:contrast
```

Parses the palette files themselves — not a copy of the values — resolves
`var()` chains, composites translucent tokens over what sits behind them, and
checks **97 assertions**: theme parity, plus every pairing above across light,
dark, and both high-contrast modes. Exits non-zero on failure. Zero
dependencies, so it runs with no `node_modules` present.

It runs in CI on both `ci-pms-ui.yml` and `ci-guest-portal.yml`, and both
workflows trigger on `UI/shared-styles/**`. It is also part of `pnpm run check`,
so `pnpm run build` covers it locally. **Run it after touching any palette file.**

`nx.json` declares this directory as the `sharedUiStyles` named input on the
`build` target. Without it Nx scopes build inputs to `{projectRoot}/**/*`, this
directory sits outside both apps, and a palette edit produces a **cache hit** —
the guard would check the new values while the app shipped a bundle built from
the old ones. That was the state until 2026-08-18; do not remove the input.

## Adding a token

1. Add it to `palette-light.css` **and** `palette-dark.css`. The parity check
   fails the build if you add it to only one.
2. Derive the name from the grammar above. If it does not fit, question the
   token before inventing a name.
3. If it carries or backs text, add the pairing to `PAIRS` in
   `check-contrast.mjs`. An unchecked pairing is how the accent badge sat at
   4.48:1 unnoticed.
4. If `prefers-contrast: more` needs a stronger value, add it to `contrast.css`
   — **both** the light and dark blocks. The dark CTA was missed exactly this
   way and sat at 5.07:1 against a 7:1 floor. Remember that darkening a status
   *text* token there also raises the bar for the *wash* it sits on.
5. Run the guard.

## Forced colors

`@media (forced-colors: active)` (Windows High Contrast) is a different problem
from `prefers-contrast`. There the OS replaces the palette outright, so token
values stop mattering and anything that encoded meaning in a background tint
loses it. The fix is structural — a real border, or a system colour like
`Highlight` / `CanvasText` / `GrayText`. See the bottom of `contrast.css`.
