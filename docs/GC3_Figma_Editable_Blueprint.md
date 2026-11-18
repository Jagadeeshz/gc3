# GC³ Portal — Figma-Editable Design Blueprint

**Quantocos Global Systems** · tokens and frame specifications for a design file that matches
the shipped product

This document is written to be imported, not read for pleasure. Section 1 is a token file in
Token Studio's JSON shape. Section 2 specifies frames by structure and measurement. Section 3
records where this differs from the earlier design brief, because a blueprint that silently
carries a palette the product does not use is worse than no blueprint.

---

## 0. Corrections to the earlier brief

Recorded first, so nobody imports the wrong palette:

| Brief said | Product uses | Why |
| --- | --- | --- |
| Accent violet `#4d19b1→#6f5adc`, teal `#9ff0ec`, `#bdf7ee` | **Gold `#c9911a` / `#f2d582` / `#8b6410`** | The site is black and gold. Spectrum appears only as a 1px *edge* gradient, never as a fill or a text colour. |
| Framer Motion (`motion/react`) | **CSS only** | No animation library ships. Scroll sequences use `animation-timeline: view()`. |
| Python microservices | **None** | One TypeScript monorepo: Next.js + Express + Prisma. |
| Hero headline `CRAFT IN` / `MOTION` | **`YOUR CHALLENGES` / `OUR SOLUTIONS`** | The hero states the proposition, not the agency's craft. |
| 8 video nodes on the ribbon | **6 pod cards, canvas-drawn** | Six is the catalogue. Cards are drawn at runtime; no third-party video is loaded. |
| 900vh scroll track | **700vh (520vh under 900px)** | 900vh put two seconds of dead scroll between the ribbon and the finale. |
| "Launch Pod" CTA | **"Book a demo"** | Matches the live navigation. |
| Brand "Quantan" | **Quantocos** | There is no Quantan in the identity. |

---

## 1. Design tokens

Import as a Token Studio set named `gc3`.

```json
{
  "global": {
    "color": {
      "ground": {
        "void":     { "value": "#0d0c11", "type": "color" },
        "raised":   { "value": "#13121a", "type": "color" },
        "card":     { "value": "#17161d", "type": "color" },
        "elevated": { "value": "#1e1d26", "type": "color" }
      },
      "ink": {
        "primary":   { "value": "#ffffff", "type": "color" },
        "secondary": { "value": "#b9b8bb", "type": "color" },
        "tertiary":  { "value": "#d3d3d7", "type": "color" },
        "muted":     { "value": "#8d8b86", "type": "color" }
      },
      "accent": {
        "gold":       { "value": "#c9911a", "type": "color" },
        "goldLight":  { "value": "#f2d582", "type": "color" },
        "goldDeep":   { "value": "#8b6410", "type": "color" },
        "danger":     { "value": "#e0795f", "type": "color" }
      },
      "line": {
        "hairline":     { "value": "rgba(255,255,255,0.10)", "type": "color" },
        "hairlineLit":  { "value": "rgba(255,255,255,0.16)", "type": "color" },
        "specularTop":  { "value": "rgba(255,255,255,0.14)", "type": "color" }
      },
      "gradient": {
        "spectrum": {
          "value": "linear-gradient(90deg,#7B00FF 0%,#3300FF 13%,#0055FF 24%,#0099FF 37%,#00DDAA 50%,#AAFF00 63%,#FFDD00 73%,#FF8800 84%,#FF2200 100%)",
          "type": "color"
        },
        "soma": {
          "value": "linear-gradient(120deg,#F2D582 0%,#C9911A 52%,#8B6410 100%)",
          "type": "color"
        }
      }
    },
    "typography": {
      "display": { "value": { "fontFamily": "Cormorant Garamond", "fontWeight": "700", "fontSize": "64", "lineHeight": "1.03", "letterSpacing": "-0.03em" }, "type": "typography" },
      "h2":      { "value": { "fontFamily": "Cormorant Garamond", "fontWeight": "700", "fontSize": "44", "lineHeight": "1.06", "letterSpacing": "-0.025em" }, "type": "typography" },
      "h3":      { "value": { "fontFamily": "Cormorant Garamond", "fontWeight": "700", "fontSize": "22", "lineHeight": "1.15", "letterSpacing": "-0.01em" }, "type": "typography" },
      "body":    { "value": { "fontFamily": "DM Sans", "fontWeight": "400", "fontSize": "14.5", "lineHeight": "1.8", "letterSpacing": "0" }, "type": "typography" },
      "bodySm":  { "value": { "fontFamily": "DM Sans", "fontWeight": "400", "fontSize": "13", "lineHeight": "1.7", "letterSpacing": "0" }, "type": "typography" },
      "kpi":     { "value": { "fontFamily": "Cormorant Garamond", "fontWeight": "700", "fontSize": "56", "lineHeight": "1", "letterSpacing": "-0.02em" }, "type": "typography" },
      "label":   { "value": { "fontFamily": "DM Mono", "fontWeight": "400", "fontSize": "10", "lineHeight": "1.4", "letterSpacing": "0.18em" }, "type": "typography" }
    },
    "radius": {
      "card": { "value": "14", "type": "borderRadius" },
      "pill": { "value": "999", "type": "borderRadius" },
      "chip": { "value": "10", "type": "borderRadius" }
    },
    "space": {
      "1": { "value": "4", "type": "spacing" },
      "2": { "value": "8", "type": "spacing" },
      "3": { "value": "12", "type": "spacing" },
      "4": { "value": "16", "type": "spacing" },
      "5": { "value": "24", "type": "spacing" },
      "6": { "value": "32", "type": "spacing" },
      "7": { "value": "48", "type": "spacing" },
      "8": { "value": "64", "type": "spacing" }
    },
    "shadow": {
      "card":    { "value": { "color": "rgba(0,0,0,0.45)", "x": "0", "y": "20", "blur": "40", "spread": "0" }, "type": "boxShadow" },
      "lifted":  { "value": { "color": "rgba(0,0,0,0.95)", "x": "0", "y": "40", "blur": "70", "spread": "-40" }, "type": "boxShadow" },
      "specular":{ "value": { "color": "rgba(255,255,255,0.14)", "x": "0", "y": "1", "blur": "0", "spread": "0", "inset": true }, "type": "boxShadow" }
    }
  }
}
```

**Grid.** 8pt base. Desktop frame 1440×900. Side margins 16 / 24 / 40px at sm / md / lg.
Content max width 1240px for consoles, 1200px for marketing bands.

---

## 2. Frames

Every screen is an auto-layout frame named `<section> / <screen>`. Nothing is a flattened
image; every label is a live text node so a stakeholder can retype copy after handover.

### 2.1 `site / Landing hero` — 1440×900

```
Frame: site / Landing hero
├─ Layer  ground plate          IMAGE fill, cover, centre 46%, brightness 0.95, saturate 0.8
├─ Layer  scrim                 radial 120%×82% at 50/46%  rgba(13,12,17,.12 → .55 → .92)
│                               + linear 180° rgba(13,12,17,.62 → .18 → .86)
├─ Layer  ribbon canvas         WebGL — in Figma: the six cards placed as described below
├─ Text   YOUR CHALLENGES       display, 124px, centred, y = 50% − .98em
├─ Text   OUR SOLUTIONS         display, 124px, centred, 42% white, y = 50% + .03em
├─ Text   caption               DM Mono 12, letter-spacing .06em, uppercase,
│                               y = 50% + clamp(58, 9.2vw, 178)
├─ Line   1px rule              gold→transparent, scaleX 0 at rest
└─ Footer row                   three columns, bottom 30px:
      proposition (max 34ch, 12.5px, ink secondary)
      facts strip  (DM Mono 10.5, letter-spacing .08em)
      "See the pods" (DM Mono, gold, + 22px hairline)
```

For a still frame of the ribbon, place the six cards on a receding arc rather than a row:
the arc runs from the front-left, turns away past centre and returns at the far right, card
height falling from 186px at the near end to ~120px at the far end, each rotated to face the
arc's tangent (roughly −38° to +22° z over the run) and stepped back in z by 48px. That is
the shape the WebGL curve produces; it will not be exact, and it does not need to be — the
frame only has to communicate a ribbon, not replay it.

The **pricing page** carries a separate deck: six 300×186 cards, card 1 at the origin, each
following card stepped +62px x, +28px y, −48px z, rotated +1.6° z, whole deck rotated −12° y
under 1300px perspective. There depth is brightness (1.0 → 0.60), not opacity.

### 2.2 `site / Landing finale` — 1440×900

```
Frame: site / Landing finale
├─ Layer  ground plate          as above, slightly stronger scrim
├─ Ellipse soft scrim           60% opacity radial behind the type block
├─ Text   QUANTOCOS / GLOBAL SYSTEMS   DM Mono 11, letter-spacing .22em, gold-light
├─ Text   Intelligence, engineered at the edge.   display, 66px, centre, max 46rem,
│                                               white → 62% vertical fade
├─ Text   body                  DM Sans 15, 46ch, ink secondary
└─ Button SEE THE PODS          soma gradient, 40px tall, radius pill, ink = ground
```

### 2.3 `client / Overview` — 1440×900

```
Frame: client / Overview
├─ Frame  sidebar               width 248, fill raised, 1px hairline right
│    ├─ mark + wordmark         24px height
│    ├─ nav rows                40px tall, radius 10, active row = gold fill + ground ink
│    └─ footer                  avatar 32, role label, sign-out link
├─ Frame  top bar               height 64, sticky, hairline bottom
│    └─ title, role pill, quick action (soma pill)
└─ Frame  content               padding 32, gap 24
     ├─ Row  KPI cards × 4       each 280×132, radius 14, gradient edge, wash tint,
     │                          label DM Mono 9, value display 56 tabular
     ├─ Row  plan usage × 3      progress rail 6px, radius pill, fill gold
     │                          warning = gold, exceeded = danger red
     ├─ Frame project status     4 columns, header row, item rows 32px
     └─ Frame recent requests   table, sticky header, 12.5px rows
```

### 2.4 `staff / Operations` — 1440×900

```
Frame: staff / Operations
├─ Frame  sidebar               as client, plus ops section
├─ Frame  tabs                  36px pills, active = gold fill + ground ink
└─ Frame  content
     ├─ Row  cross-tenant KPIs  × 5
     ├─ Frame pods + rosters    table: pod · manager · specialists · agents · clients (max 3)
     ├─ Frame SLA risk sweep    rows with priority badge and time-to-breach
     └─ Frame internal tasks    assignee avatars, state chips
```

### 2.5 `staff / Analytics`, `staff / Billing`

Same shell. Analytics: line and bar series, single gold ink, glowing end points, no grid
lines beyond a 6% hairline. Billing: invoice table with status chips —
`DRAFT` neutral, `ISSUED` gold, `PAID` gold-light, `OVERDUE` danger, `VOID` muted.

### 2.6 `client / Requests` and `client / Deliverables`

Requests: filter bar, list rows 44px, priority chip, status chip, commitment clock. Detail
screen: two columns — thread on the left, metadata rail (owner, pod, window, at-risk state)
on the right.

Deliverables: grid of file cards with version badge (`v3`), SHA-256 short reference in DM
Mono, and release state. Approved and released states use gold-light; a released deliverable
cannot be edited, so its card carries no edit affordance.

---

## 3. Components to build from the tokens

| Component | Spec |
| --- | --- |
| `Button / primary` | 40px tall, pill, soma gradient fill, ink = `ground.void`, letter-spacing .04em, hover lifts 1px and adds a gold glow |
| `Button / glass` | 40px tall, pill, transparent fill, 1px `line.hairlineLit`, ink primary, hover border gold |
| `Chip / status` | 22px tall, pill, radius 999, 1px edge, label DM Mono 9 uppercase, colour by state |
| `Card / surface` | radius 14, fill `ground.card`, 1px hairline, gradient edge overlay at 1.5px, specular top inset |
| `Card / KPI` | as surface + translucent gold wash, value tabular, delta in DM Mono |
| `Table row` | 44px tall, hairline divider, hover raises row background to `ground.elevated/40` |
| `Input` | 40px tall, radius 10, fill `ground.void`, 1px hairline, focus ring gold at 40% |
| `Nav row` | 40px tall, radius 10, icon 16, label DM Sans 13, active = gold fill + ground ink |

**Edge treatment, in Figma:** draw the gradient ring as a separate 1px stroke layer with the
`gradient.spectrum` fill, clipped to the frame's radius, and set the frame fill separately —
Figma has no `background-clip` equivalent, so the ring cannot be a stroke property.

---

## 4. Import notes

- Tokens: Token Studio, set `gc3`. The gradient values are CSS strings; Figma needs them
  applied as gradient fills manually (9 stops for spectrum, 3 for soma).
- Fonts must exist locally: Cormorant Garamond 700, DM Sans 300–600, DM Mono 400/500. A
  missing family aborts a node load rather than substituting.
- Screens are 1440×900 and 1280×800 for console detail views. Do not build a page wider than
  four columns at 1280 plus gutters; it becomes unreadable at zoom-out.
- Where a panel is not backed by data in the product, the frame says so in words. Do not draw
  a plausible zero.
