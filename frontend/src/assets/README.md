# NORA marketplace assets

These are original, local placeholder illustrations created to match the supplied visual reference. They do not require an external image service or network connection. Business images are illustrative placeholders rather than real photographs or official business identities.

The frontend uses the PNG/JPG exports below. Editable SVG sources live beside each export so the art can be replaced or adjusted without changing component markup.

| Asset | Export dimensions | Notes |
| --- | --- | --- |
| `brand/nora-logo.png` | 96 × 112 | Transparent sprout icon; the wordmark is rendered as interface text. |
| `illustrations/marketplace-hero.png` | 1000 × 440 | Transparent sky, mountains, sun, hills, and trees; decorative copy is rendered separately. |
| `businesses/logos/andes-solar.png` | 320 × 320 | Transparent corners around the circular solar logo. |
| `businesses/logos/altiplano-quinoa.png` | 320 × 320 | Transparent corners around the circular quinoa logo. |
| `businesses/logos/andesoft.png` | 320 × 320 | Transparent corners around the rounded green identity. |
| `businesses/photos/vallesur-desarrollos.jpg` | 480 × 480 | Modern home and Andean mountain illustration. |
| `businesses/photos/rutas-del-oriente.jpg` | 480 × 480 | Freight truck on an Andean mountain road illustration. |
| `businesses/photos/clinica-sumasalud.jpg` | 480 × 480 | Clinic facade illustration. |
| `placeholders/fallback.svg` | 320 × 320 | Generic landscape and sprout used when a business image cannot load. |

To replace a placeholder, keep the same filename and export type. Square business images work best with the card's `object-fit: cover` treatment. Preserve alpha transparency for the brand and hero PNGs. Keep the hero's artwork low in the frame to leave space for the overlaid decorative phrases.

The existing `hero.png`, `react.svg`, and `vite.svg` files predate this implementation and are preserved.
