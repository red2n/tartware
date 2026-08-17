# Shared design tokens

The single source of colour and shape for **both** UI apps — `pms-ui` (staff)
and `guest-portal` (guests). Neither app owns these files. Change a value here
and both apps move together; that is the point.

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

## The token set

Semantic, never literal. `--fgColor-danger` is "text that means something went
wrong", not "red".

**Surfaces** `--bgColor-default` (the page) · `--bgColor-muted` (panels, cards,
sidebars) · `--bgColor-inset` (wells) · `--bgColor-emphasis` (high-contrast
surface, always dark)

**Text** `--fgColor-default` · `--fgColor-muted` (secondary) ·
`--fgColor-onEmphasis` (on an accent or emphasis fill) · `--fgColor-accent`
(links)

**Status** `--fgColor-success` · `--fgColor-danger` · `--fgColor-attention` ·
`--fgColor-done`, each with a matching `--bgColor-*-muted` fill

**Borders** `--borderColor-default` (decorative separators only — it is 1.3:1
and deliberately so) · `--borderColor-control` (**use this on anything a user
operates**; it is the one that clears the 3:1 WCAG 1.4.11 boundary rule) ·
`--borderColor-accent-emphasis` (focus rings)

**Actions** `--bgColor-accent-emphasis` · `--button-primary-bgColor-rest` /
`-hover` / `-active`

### Two traps worth naming

`--borderColor-default` is **not** good enough for an input. It is 1.31:1 on
white — fine for a rule between table rows, invisible as a control boundary.
Inputs, checkboxes and anything else operable take `--borderColor-control`.

`--accent-decorative` (`#2081e2`, the showcase blue) is only 3.96:1 and **must
never carry text or sit behind a white label**. It exists for glows, gradients
and washes. The blue that text uses is `--fgColor-accent`.

## Contrast floors

From WCAG 2.2. The guard enforces all of these.

| Context | Normal | `prefers-contrast: more` |
|---------|-------:|-------------------------:|
| Body text (1.4.3 / 1.4.6) | 4.5:1 | 7:1 |
| Control boundary, focus ring (1.4.11) | 3:1 | 4.5:1 |

Check text against the **panel** as well as the page. Most forms sit on
`--bgColor-muted`, and that is where borderline values fail — it is exactly how
`--borderColor-control` slipped through at 2.96:1.

## The guard

```bash
node UI/shared-styles/check-contrast.mjs
```

Parses the palette files themselves — not a copy of the values — resolves
`var()` chains, composites translucent tokens over what sits behind them, and
checks 72 pairings across light, dark, and both high-contrast modes. Exits
non-zero on failure. Zero dependencies, so it runs with no `node_modules`
present. **Run it after touching any palette file, and wire it into CI.**

## Adding a token

1. Add it to `palette-light.css` **and** `palette-dark.css`. A token that
   exists in one theme is a bug waiting for the other theme.
2. If it carries or backs text, add the pairing to `PAIRS` in
   `check-contrast.mjs`.
3. If `prefers-contrast: more` needs a stronger value, add it to `contrast.css`
   — **both** the light and dark blocks. The dark CTA was missed exactly this
   way and sat at 5.07:1 against a 7:1 floor.
4. Run the guard.

## Forced colors

`@media (forced-colors: active)` (Windows High Contrast) is a different problem
from `prefers-contrast`. There the OS replaces the palette outright, so token
values stop mattering and anything that encoded meaning in a background tint
loses it. The fix is structural — a real border, or a system colour like
`Highlight` / `CanvasText` / `GrayText`. See the bottom of `contrast.css`.
