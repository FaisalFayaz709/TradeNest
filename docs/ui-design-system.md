# TradeNest UI Design System — Patch 01

This page documents the shared primitives in `apps/web` and how they implement
Technical Blueprint §4 (visual language) and §10 (layered validation). It is a
**design and source-level** contract, not proof of browser responsiveness.

## Brand first, accessibility always

Keep the original brand swatches (do not silently recolor them):

| Swatch | Hex | Appropriate use |
| --- | --- | --- |
| Navy | `#0B2A4A` | Trust, headers, primary actions |
| Blue | `#124C7C` | Primary hover, text links |
| Teal | `#0FA3A3` | AI icons, accent surfaces, graphics; **not small white text on teal** |
| Teal Light | `#DDF7F5` | Calm AI information surfaces |
| Gold | `#D6A84B` | Escrow illustrations and accents; **not small gold text on white** |
| Gold Light | `#FFF6DF` | Escrow background/accent |
| Background | `#F7F9FC` | Site background |

The reference theme is deliberately light, with Inter and restrained shadows.

### Semantic readable colors

The darker token variants in `globals.css` are intentionally separate from the
brand colors. Use them where a text or filled-button contrast ratio matters:

- `--tradenest-teal-ink` (`#076D70`) — teal labels on light surfaces.
- `--tradenest-teal-action` (`#087575`) — white-on-teal AI buttons.
- `--tradenest-teal-hover` (`#065C5E`) — AI button hover.
- `--tradenest-gold-ink` (`#7B530C`) — escrow badge foreground.
- `--tradenest-success-ink` (`#116932`) — success text on pale surfaces.
- `--tradenest-warning-ink` (`#92400E`) — warning text on pale surfaces.
- `--tradenest-danger-ink` (`#B91C1C`) — error/status text on pale surfaces.
- `--tradenest-focus` (`#087575`) — keyboard focus ring.
- `--tradenest-placeholder` (`#64748B`) — readable placeholder copy.
- `--tradenest-border-strong` (`#7B8796`) — form control outlines.

For icons, illustrations, non-text decoration, and accents, original teal/gold
remain appropriate. Don't use warning/success badge colors as decorative accents.

The source test `node --test scripts/tests/ui-design-system.test.mjs` checks
contrast for the declared *representative* text/button/surface pairs. It does
not prove all hard-coded text colors on every existing page are accessible.

## Shared component expectations

- `Button`: Navy default, lighter gold-tint secondary, dark-teal AI variant,
  accessible focus ring, at least **44px** target height in regular/small/icon
  sizes, and multiline labels when narrow. Actual clickable sizes still depend
  on surrounding markup and responsive containers.
- `Badge`: readable semantic ink colors; status meaning should also be text,
  never conveyed by color alone.
- `Card`: 16px corners, modest shadow, compact padding at phone widths.
- `Input`/`Textarea`: 10px corners, visible focus, accessible placeholder,
  `aria-invalid` affordances, and 16px input text on phones to discourage iOS
  focus zoom. Bind server validation errors to `aria-invalid` on pages later.
- `PageShell`: responsive title sizing and a wrapping action container.
- Dialog/modal radius remains 20px for future shared modal components.

## Manual browser acceptance — required after dependencies are available

Review a representative public page, an auth form, product detail, cart,
checkout, Seller and Admin screens at **320, 375, 390, 768, 820, 1024, 1440,
1920** pixels, plus 200% zoom. Check overflow, clipped controls, keyboard
focus, form errors, disabled states, tall mobile viewport and long content.

Patch 01 intentionally does not rewrite site navigation, nested Link/Button
patterns, customer copy, or individual complex page layouts. Those belong to
Patches 02–16. Do not claim all-device acceptance until Patch 17 browser tests
are executed and human screenshots are reviewed.
