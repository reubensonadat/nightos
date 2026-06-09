# Restaurant POS Design System — Skill Definition

> **Purpose**: This document encodes the complete design DNA for building a restaurant POS system with a specific visual and psychological language. Any agent — regardless of baseline capability — should be able to read this file and produce screens that feel like they were designed by a team of UI/UX experts who understand human psychology, cognitive load theory, and the emotional weight of every pixel.
>
> **Philosophy**: Design is not decoration. Design is communication. Every color, radius, shadow, and transition exists because a human brain will interpret it before the conscious mind reads a single word. This system is built on the principle that a restaurant POS must feel as intuitive as breathing and as beautiful as the food it represents — because the person using it is often stressed, rushed, and making split-second decisions that affect real revenue.

---

## Table of Contents

1. [Foundational Psychology](#1-foundational-psychology)
2. [Color System](#2-color-system)
3. [Glassmorphism Language](#3-glassmorphism-language)
4. [Typography System](#4-typography-system)
5. [Spatial Grid & Spacing](#5-spatial-grid--spacing)
6. [Border Radius System](#6-border-radius-system)
7. [Shadow & Elevation System](#7-shadow--elevation-system)
8. [Icon Language](#8-icon-language)
9. [Navigation Architecture](#9-navigation-architecture)
10. [Component Specifications](#10-component-specifications)
11. [Screen Blueprints](#11-screen-blueprints)
12. [Interaction & Animation Language](#12-interaction--animation-language)
13. [State Management Patterns](#13-state-management-patterns)
14. [Accessibility & Readability](#14-accessibility--readability)
15. [Anti-Patterns — What Never To Do](#15-anti-patterns--what-never-to-do)
16. [Design Decision Rationale Index](#16-design-decision-rationale-index)

---

## 1. Foundational Psychology

Every design decision in this system traces back to one of these psychological principles. If you are ever uncertain about a design choice, return here.

### 1.1 Cognitive Load Theory

A restaurant POS operator processes orders in a high-stress, time-pressured environment. The interface must minimize extraneous cognitive load — every element that does not directly serve the task at hand is noise.

- **Rule of One Glance**: Any critical piece of information (order total, table status, item price) must be comprehensible in under 200ms of visual attention.
- **Progressive Disclosure**: Never show all options at once. Surface the 80% use case immediately; bury the 20% edge case one interaction deeper.
- **Chunking**: Group related information visually so the brain processes it as one unit, not separate items. An order with 5 items should feel like "one order," not "five separate decisions."

### 1.2 Color Psychology for Food Environments

- **Warmth triggers appetite and comfort.** Cool tones suppress it. The system leans warm.
- **Green signals "go," "correct," "confirmed."** Use it for positive actions, confirmed states, and success feedback.
- **Red/coral signals urgency and attention.** Use it sparingly for alerts, promotional badges, and destructive action warnings — never as a primary interface color.
- **Black conveys authority and finality.** Use it for primary action buttons and critical totals. It says "this matters."
- **White creates mental breathing room.** In a busy kitchen or crowded counter, a clean white interface reduces visual stress.

### 1.3 Hick's Law Applied

The time to make a decision increases logarithmically with the number of choices. Therefore:

- Menu categories should never exceed 8 visible options at any level.
- Action buttons per screen section should be capped at 3: Primary, Secondary, Tertiary — in that visual hierarchy.
- The default state of every screen should present the most likely action path without requiring search.

### 1.4 Fitts's Law Applied

The time to acquire a target is proportional to its distance and inversely proportional to its size. Therefore:

- Primary action targets (Pay, Send Order, Add Item) must be the largest touch targets on screen.
- Frequently used buttons must be positioned in the bottom-right or bottom-center of the viewport — the natural resting position of the thumb on a tablet.
- Destructive or infrequent actions (Cancel, Void, Delete) must be smaller and positioned away from the thumb's natural arc.

### 1.5 Gestalt Principles

- **Proximity**: Items placed close together are perceived as related. Order line items, modifier groups, and payment totals each form their own proximity cluster.
- **Similarity**: Consistent styling signals consistent function. All "Add" buttons look identical. All status badges share the same shape.
- **Continuity**: The eye follows the smoothest path. Order flow should read naturally: Select Item → Customize → Confirm → Next. The layout should guide this path without explicit arrows.
- **Figure-Ground**: Glassmorphism exploits this principle — the frosted layer is "figure" and the blurred content behind is "ground." This makes overlay panels, modals, and sidebars feel naturally separated without harsh borders.

### 1.6 Emotional Design — Visceral, Behavioral, Reflective

- **Visceral (First Impression)**: The glassmorphic surfaces, soft shadows, and warm accents create an immediate feeling of "this is premium, this is modern, this is trustworthy." The user feels it before they think it.
- **Behavioral (During Use)**: Fast feedback, smooth transitions, and predictable layouts create a feeling of competence and control. The user feels like they are good at their job because the system makes them fast.
- **Reflective (After Use)**: The cohesive beauty of the system creates pride of ownership. A manager feels their restaurant is more professional because their POS looks professional.

---

## 2. Color System

This is not a palette. This is a communication system. Every color has a job.

### 2.1 Core Neutrals — The Canvas

| Token | Hex | RGB | Usage | Psychological Role |
|---|---|---|---|---|
| `--surface-base` | `#FFFFFF` | 255, 255, 255 | Primary background | Purity, clarity, breathing room |
| `surface-raised` | `#FAFAFA` | 250, 250, 250 | Card backgrounds, secondary surfaces | Subtle elevation without harshness |
| `surface-muted` | `#F3F4F6` | 243, 244, 246 | Input backgrounds, disabled surfaces | Resting state, inactive zones |
| `surface-overlay` | `rgba(255,255,255,0.85)` | — | Glassmorphic panel backgrounds | Frosted separation (see Section 3) |
| `border-subtle` | `#E5E7EB` | 229, 231, 235 | Dividers, input borders, card edges | Gentle containment, never aggression |
| `border-medium` | `#D1D5DB` | 209, 213, 219 | Active input borders, hover states | Slightly more presence when engaged |
| `text-primary` | `#111827` | 17, 24, 39 | Headings, critical information | Authority, importance, must-read |
| `text-secondary` | `#374151` | 55, 65, 81 | Body text, descriptions | Comfortable reading, supports primary |
| `text-tertiary` | `#6B7280` | 107, 114, 128 | Labels, hints, secondary metadata | Available but not demanding attention |
| `text-quaternary` | `#9CA3AF` | 156, 163, 175 | Placeholders, timestamps, disabled text | Barely present, ghost information |

### 2.2 Accent Colors — The Voice

| Token | Hex | RGB | Usage | Psychological Role |
|---|---|---|---|---|
| `accent-action` | `#111827` | 17, 24, 39 | Primary buttons, key totals, critical CTAs | Authority, finality, "do this now" |
| `accent-positive` | `#059669` | 5, 150, 105 | Confirmed orders, success states, "go" signals | Growth, correctness, all-clear |
| `accent-positive-light` | `#D1FAE5` | 209, 250, 229 | Positive state backgrounds, tags | Soft confirmation, gentle success |
| `accent-urgency` | `#DC2626` | 220, 38, 38 | Low-stock alerts, void warnings, critical errors | Danger, stop, immediate attention |
| `accent-urgency-light` | `#FEE2E2` | 254, 226, 226 | Urgency backgrounds, soft alert cards | Gentle warning, not alarm |
| `accent-promo` | `#EA580C` | 234, 88, 12 | Promotional badges, discounts, special offers | Energy, appetite, limited-time value |
| `accent-promo-light` | `#FFF7ED` | 255, 247, 237 | Promo backgrounds, offer cards | Warm invitation, comfortable urgency |
| `accent-warm` | `#D97706` | 217, 119, 6 | Highlighted items, featured dishes, "popular" tags | Warmth, appetite, premium feel |
| `accent-warm-light` | `#FEF3C7` | 254, 243, 199 | Warm backgrounds, featured cards | Comfort, premium invitation |

### 2.3 Color Pairing Rules

- **Never** place two accent colors adjacent to each other. Accents need neutral space to breathe.
- **Always** pair a saturated accent with its `-light` variant for background-foreground consistency. A `accent-positive` badge sits on a `accent-positive-light` background.
- **Dark surfaces reverse the system**: On `accent-action` (#111827) backgrounds, text becomes white (#FFFFFF), borders become `rgba(255,255,255,0.12)`, and muted text becomes `rgba(255,255,255,0.60)`.
- **Glassmorphic surfaces** use `surface-overlay` with transparency — never a solid opaque color on a blurred panel.

### 2.4 Context-Specific Color Applications for Restaurant POS

| Context | Background | Primary Element | Accent | Rationale |
|---|---|---|---|---|
| Menu Item Card (default) | `#FFFFFF` | `text-primary` | `border-subtle` | Clean, focused on food imagery |
| Menu Item Card (selected) | `accent-positive-light` | `text-primary` | `accent-positive` | Clear "added to order" signal |
| Menu Item Card (unavailable) | `surface-muted` | `text-quaternary` | `border-subtle` | Visually muted = mentally unavailable |
| Category Pill (active) | `accent-action` | `#FFFFFF` | none | Authority: "you are here" |
| Category Pill (inactive) | `surface-raised` | `text-secondary` | `border-subtle` | Available but not demanding |
| Order Ticket (active) | `#FFFFFF` | `text-primary` | `accent-positive` (left border) | Live, in-progress order |
| Order Ticket (completed) | `surface-raised` | `text-tertiary` | `border-subtle` | Visually retired, completed task |
| Payment Success | `accent-positive-light` | `accent-positive` | `accent-positive` | Full positive reinforcement |
| Void/Cancel Confirm | `accent-urgency-light` | `accent-urgency` | `accent-urgency` | Full warning, deliberate friction |
| Discount/Promo Badge | `accent-promo` | `#FFFFFF` | none | Eye-catching, appetite-triggering urgency |
| Table Status (available) | `accent-positive-light` | `accent-positive` | `accent-positive` | Green = go, seat them now |
| Table Status (occupied) | `accent-warm-light` | `accent-warm` | `accent-warm` | Warm = active, being served |
| Table Status (reserved) | `surface-muted` | `text-tertiary` | `border-medium` | Neutral = planned, not yet active |
| Table Status (overdue) | `accent-urgency-light` | `accent-urgency` | `accent-urgency` | Red = attention needed now |

---

## 3. Glassmorphism Language

Glassmorphism is not a decorative trend in this system — it is a **functional tool for layer hierarchy**. It tells the user "this panel is above that content" through the physics of light, not through harsh borders or opaque walls.

### 3.1 When to Use Glassmorphism

| Component Type | Glassmorphic? | Rationale |
|---|---|---|
| Side panels / drawer overlays | Yes | Must visually separate from content below while maintaining spatial context |
| Modal dialogs | Yes | Floats above all content; blurred background reinforces "focus here" |
| Notification toasts | Yes | Transient; should not fully obscure underlying content |
| Category filter bars | Yes | Scrolled content passes beneath; frosted bar stays readable |
| Status bar overlays on hero images | Yes | Must remain readable over variable image content |
| Primary content cards | No | These ARE the content — they should be solid and grounded |
| Form input fields | No | Must be crisp and unambiguous for data entry |
| Button elements | No | Buttons must feel solid and clickable, not ethereal |

### 3.2 Glassmorphism Specifications

#### Layer 1 — Standard Frosted Panel (side panels, filter bars)

```css
background: rgba(255, 255, 255, 0.82);
backdrop-filter: blur(16px) saturate(180%);
-webkit-backdrop-filter: blur(16px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.45);
border-radius: 16px;
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
```

**Why these values**: 82% opacity allows the background to be perceived without being distracting. 16px blur is the sweet spot — less feels like a mistake, more feels like cataracts. 180% saturation prevents the frosted layer from looking washed out. The white border at 45% opacity creates a subtle "glow edge" that separates the glass from whatever is behind it.

#### Layer 2 — Elevated Frosted Panel (modals, important overlays)

```css
background: rgba(255, 255, 255, 0.90);
backdrop-filter: blur(24px) saturate(200%);
-webkit-backdrop-filter: blur(24px) saturate(200%);
border: 1px solid rgba(255, 255, 255, 0.55);
border-radius: 20px;
box-shadow: 0 16px 48px rgba(0, 0, 0, 0.10), 0 4px 16px rgba(0, 0, 0, 0.04);
```

**Why these values**: Higher opacity (90%) and blur (24px) because modals demand more focus. The user should see less of the background and more of the modal. The dual shadow creates a sense of the panel floating closer to the user — the larger shadow is the "ambient" shadow, the smaller one is the "contact" shadow.

#### Layer 3 — Subtle Frosted Element (toasts, floating badges, hover cards)

```css
background: rgba(255, 255, 255, 0.72);
backdrop-filter: blur(12px) saturate(160%);
-webkit-backdrop-filter: blur(12px) saturate(160%);
border: 1px solid rgba(255, 255, 255, 0.35);
border-radius: 12px;
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
```

**Why these values**: Lower opacity and blur because these elements are supplementary — they should blend more with the background, appearing as gentle whispers rather than demanding attention.

#### Dark Glassmorphism Variant (for dark mode or dark hero overlays)

```css
background: rgba(17, 24, 39, 0.75);
backdrop-filter: blur(20px) saturate(180%);
-webkit-backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.10);
border-radius: 16px;
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.20);
```

**Why these values**: Dark glass reverses the logic — the border is white at very low opacity to create a faint highlight edge, and the shadow is stronger because dark surfaces need more contrast to feel elevated against dark backgrounds.

### 3.3 Glassmorphism Anti-Patterns

- **NEVER** use glassmorphism on glassmorphism. If a frosted panel contains a sub-panel, the sub-panel must be solid.
- **NEVER** place glassmorphic surfaces over other glassmorphic surfaces. The compound blur creates visual confusion.
- **NEVER** use glassmorphism for text-heavy surfaces where the background is variable. If the user might see text through text, the readability cost is too high.
- **NEVER** use glassmorphism without ensuring sufficient contrast ratio between the frosted layer and whatever is behind it. Test against photographic, gradient, and solid backgrounds.

---

## 4. Typography System

Typography in a POS is not about personality — it is about speed. The operator must read an item name, a price, or a modifier in a fraction of a second, often while looking away from the screen. The type system must be ruthlessly legible.

### 4.1 Font Family

**Primary**: `Inter` — A geometric sans-serif optimized for screens. Its tall x-height and open apertures make it exceptionally legible at small sizes, which is critical for dense POS layouts.

**Fallback Stack**: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

**Monospace** (for prices, totals, order numbers): `JetBrains Mono, 'SF Mono', 'Fira Code', monospace` — Tabular figures ensure prices align perfectly in columns.

### 4.2 Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|---|---|---|---|---|---|
| `display` | 36px | 800 | 1.15 | -0.02em | Hero section numbers, grand total on payment screen |
| `heading-1` | 28px | 700 | 1.20 | -0.015em | Screen titles, section headers |
| `heading-2` | 22px | 600 | 1.25 | -0.01em | Card titles, table numbers, category headers |
| `heading-3` | 18px | 600 | 1.30 | -0.005em | Item names in lists, sub-section headers |
| `body-large` | 16px | 400 | 1.50 | 0em | Primary body text, order item details |
| `body` | 14px | 400 | 1.50 | 0em | Default body text, descriptions, labels |
| `body-small` | 13px | 400 | 1.45 | 0.01em | Secondary details, modifier text |
| `caption` | 12px | 500 | 1.35 | 0.02em | Timestamps, badges, status labels |
| `micro` | 11px | 500 | 1.30 | 0.03em | Very small labels, keyboard shortcuts hints |
| `price` | 16px | 600 | 1.30 | 0.01em | Item prices (monospace) |
| `price-large` | 24px | 700 | 1.20 | 0em | Order totals, payment amounts (monospace) |
| `price-display` | 36px | 800 | 1.15 | -0.02em | Grand total on payment screen (monospace) |

### 4.3 Typography Rules

- **Prices always use monospace** with `font-variant-numeric: tabular-nums`. Decimal points must align vertically in any list of prices.
- **Negative letter spacing on large text** (display, heading-1, heading-2) prevents the optical looseness that occurs at large sizes. The letters "breathe" better when slightly tighter.
- **Positive letter spacing on small text** (caption, micro) prevents the letters from collapsing into each other, maintaining legibility at tiny sizes.
- **Never use all-caps for body text.** All-caps is reserved for badge labels, status tags, and section dividers — places where 2-4 words act as visual anchors.
- **Truncate, never wrap** for item names in tight lists. Use `text-overflow: ellipsis` with a single line. The full name appears on hover or in detail view.

### 4.4 Number Formatting Rules

- Always show currency symbol at the same visual weight as the number.
- Two decimal places always: `$12.50`, never `$12.5`.
- Use thin-space between currency symbol and amount for optical balance: `$ 12.50` (with `&thinsp;`).
- Negative amounts (refunds, discounts) use `accent-urgency` color and a minus prefix: `-$ 5.00`.

---

## 5. Spatial Grid & Spacing

The spacing system is based on a **4px base unit** with an **8px preferred step**. Every measurement in the system is a multiple of 4. This creates a visual rhythm that the brain perceives as order, even if it cannot articulate why.

### 5.1 Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Inline icon padding, tight badge spacing |
| `space-2` | 8px | Related elements within a group, icon-text gap |
| `space-3` | 12px | Tight component internal padding, list item gaps |
| `space-4` | 16px | Standard component padding, card internal padding, field gaps |
| `space-5` | 20px | Section-internal spacing, comfortable element separation |
| `space-6` | 24px | Section dividers, card external margins |
| `space-7` | 32px | Major section separation, panel internal padding |
| `space-8` | 40px | Page-level vertical rhythm |
| `space-9` | 48px | Top-level section gaps, generous breathing room |
| `space-10` | 64px | Hero section spacing, major visual breaks |

### 5.2 Layout Grid for POS

The POS system uses a **fixed sidebar + fluid content** layout:

```
+------------------+---------------------------------------------+
|                  |                                             |
|   SIDEBAR NAV    |          MAIN CONTENT AREA                  |
|   (fixed 72px    |          (fluid, min 600px)                 |
|   collapsed /    |                                             |
|   240px expanded)|                                             |
|                  |                                             |
|   +----------+   |   +-----------------------------------+    |
|   | Nav Item |   |   |  Content Card / Panel             |    |
|   +----------+   |   |  (max-width: 1200px, centered)    |    |
|   +----------+   |   +-----------------------------------+    |
|   | Nav Item |   |                                             |
|   +----------+   |                                             |
|                  |                                             |
+------------------+---------------------------------------------+
```

**Sidebar**: Fixed to the left. 72px collapsed (icon only), 240px expanded (icon + label). Transition between states is 300ms ease-in-out. The sidebar uses dark glassmorphism on a `accent-action` base.

**Main Content**: Fluid, filling the remaining viewport. Content within is constrained to `max-width: 1200px` and centered. Left/right padding is `space-6` (24px) on desktop, `space-4` (16px) on tablet.

**Two-Column Layout** (for order screens): Left 60% for menu, right 40% for current order. Divider is 1px `border-subtle`.

**Three-Column Layout** (for table management): Left 25% for table list, center 50% for table detail/order, right 25% for order summary. Dividers are 1px `border-subtle`.

### 5.3 Touch Target Sizing

In a restaurant environment, users operate the POS with fingers, not mouse cursors. Touch targets must be generous.

| Element | Minimum Size | Preferred Size | Padding |
|---|---|---|---|
| Primary action button | 44 x 44px | 48 x 48px | 12px 24px |
| Secondary action button | 40 x 40px | 44 x 44px | 10px 20px |
| Menu item card (tap target) | 64 x 64px | 80 x 80px | — |
| Category pill | 36 x 36px | 40 x 40px | 8px 16px |
| Icon button (icon only) | 40 x 40px | 44 x 44px | — |
| List row (order item) | 44px height | 52px height | 12px 16px |
| Input field | 44px height | 48px height | 12px 16px |

---

## 6. Border Radius System

Border radius communicates softness vs. precision. A restaurant POS should feel warm and approachable, not clinical and rigid. But it must also feel professional and controlled — not playful.

### 6.1 Radius Scale

| Token | Value | Usage | Psychological Signal |
|---|---|---|---|
| `radius-none` | 0px | Data table cells, sharp dividers | Precision, tabular data |
| `radius-sm` | 4px | Badges, tags, small indicators | Controlled, slightly soft |
| `radius-md` | 8px | Buttons, inputs, dropdowns | Friendly but professional |
| `radius-lg` | 12px | Cards, panels, list items | Warm, approachable |
| `radius-xl` | 16px | Large cards, modal bodies, overlays | Inviting, modern |
| `radius-2xl` | 20px | Hero sections, major panels | Soft, premium feel |
| `radius-pill` | 9999px | Category pills, status badges, CTAs | Friendly, approachable, "tap me" |
| `radius-circle` | 50% | Avatars, icon containers, status dots | Human, organic, personal |

### 6.2 Radius Rules

- **Outer containers always have larger radius than inner elements.** A card (`radius-lg`) contains buttons (`radius-md`). Never the reverse — it creates visual tension.
- **Primary CTA buttons use `radius-pill`** — the fully rounded shape draws the eye and says "tap me." It is the most approachable shape.
- **Destructive action buttons use `radius-md`** — the less rounded shape creates subtle visual friction, making the user slow down slightly before confirming.
- **Icons inside circular containers** (`radius-circle`) should have 4px padding between the icon edge and the container edge.
- **Consistent radius within a screen** — all cards on the same screen must share the same radius. All buttons on the same screen must share the same radius. Mixing radii within the same hierarchical level creates visual chaos.

---

## 7. Shadow & Elevation System

Shadows create depth, and depth creates hierarchy. In a restaurant POS, the element that matters most right now should feel closest to the user.

### 7.1 Elevation Levels

| Level | Shadow CSS | Usage | Elevation Meaning |
|---|---|---|---|
| `elevation-0` | `none` | Flat surfaces, base page, inline elements | Ground level |
| `elevation-1` | `0 1px 2px rgba(0,0,0,0.05)` | Cards at rest, list items | Subtly above ground |
| `elevation-2` | `0 2px 8px rgba(0,0,0,0.07)` | Cards on hover, active input fields | Engaged, interactive |
| `elevation-3` | `0 4px 16px rgba(0,0,0,0.08)` | Dropdown menus, floating panels | Above content |
| `elevation-4` | `0 8px 32px rgba(0,0,0,0.10)` | Side panels, drawer overlays | Significant elevation |
| `elevation-5` | `0 16px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)` | Modal dialogs, confirmation overlays | Highest elevation, maximum focus |

### 7.2 Shadow Rules

- **Shadows are warm.** When on a light background, shadows use `rgba(0,0,0,x)`. When on a colored background, shadows subtly inherit the background color for a more natural appearance.
- **Never use inset shadows** on interactive elements. They make buttons look pressed/disabled.
- **Shadow direction is always down and slightly right** — this mimics natural light from above, which the human brain is calibrated to expect.
- **Active/pressed states reduce shadow** — a pressed button has `elevation-0` or `elevation-1` instead of its default, creating the physical sensation of being pushed down.
- **Focus states use a glow, not a shadow** — focused elements get a `0 0 0 3px rgba(5,150,105,0.30)` ring, not an elevated shadow. This is semantically different: shadow = depth, ring = attention.

### 7.3 Glassmorphic Shadow Layering

When a glassmorphic panel needs to feel elevated, add shadows in two layers:

```css
/* Ambient shadow — large, soft, creates the "float" feeling */
box-shadow:
  0 8px 32px rgba(0, 0, 0, 0.06),
  /* Contact shadow — small, tight, creates the "grounded" feeling */
  0 2px 4px rgba(0, 0, 0, 0.04);
```

---

## 8. Icon Language

Icons in a POS must be instantaneously recognizable at arm's length. They are not art — they are language.

### 8.1 Icon System

**Style**: Outlined (stroke-based) for default states. Filled for active/selected states.

**Stroke Weight**: 1.5px for standard icons, 2px for navigation icons. The slight weight increase on nav icons ensures they read clearly at smaller sizes.

**Grid**: All icons designed on a 24px grid with 2px padding, resulting in a 20px visual area.

**Corner radius**: 2px on icon corners — this matches the `radius-sm` token and creates visual consistency with the broader system.

### 8.2 Icon Sizes

| Context | Size | Stroke Weight |
|---|---|---|
| Navigation sidebar | 24px | 2px |
| Inline with text | 16px | 1.5px |
| Button with icon | 20px | 1.5px |
| Status indicators | 12px | 1.5px |
| Feature/iconography | 32px | 2px |
| Empty state illustrations | 48-64px | 2px |

### 8.3 Restaurant POS Icon Map

| Function | Icon Description | State Handling |
|---|---|---|
| Orders / Ticket | Receipt/document with lines | Outlined default, filled when active |
| Menu / Items | Utensils (fork + knife) | Outlined default, filled when active |
| Tables / Floor Plan | Grid/square layout | Outlined default, filled when active |
| Payments | Credit card / wallet | Outlined default, filled when active |
| Kitchen Display | Chef hat / flame | Outlined default, filled when active |
| Staff / Clock-in | User with clock | Outlined default, filled when active |
| Reports / Analytics | Bar chart | Outlined default, filled when active |
| Settings | Gear | Outlined default, filled when active |
| Add item | Plus in circle | Always filled for visibility |
| Remove item | Minus in circle | Always outlined to reduce visual weight |
| Search | Magnifying glass | Always outlined |
| Filter | Funnel | Always outlined |
| Notification | Bell | Outlined default, filled when unread |
| Void / Cancel | X in circle | Always outlined with `accent-urgency` color |
| Send to Kitchen | Arrow right / paper plane | Filled with `accent-positive` color |
| Pay | Dollar sign / card tap | Filled with `accent-action` color |
| Print | Printer | Always outlined |
| Discount | Tag / percent | Always outlined with `accent-promo` color |
| Note | Pencil / sticky note | Always outlined |
| Timer | Clock | Always outlined |
| Alert / Warning | Triangle with exclamation | Filled with `accent-urgency` color |
| Success | Checkmark in circle | Filled with `accent-positive` color |
| Vegetarian | Leaf | Filled with `accent-positive` color |
| Spicy | Flame | Filled with `accent-warm` color |
| Gluten-free | Wheat with slash | Filled with `accent-warm` color |
| Popular | Star / trending arrow | Filled with `accent-warm` color |
| Modifier | Three horizontal lines with dots | Always outlined |

---

## 9. Navigation Architecture

Navigation is the skeleton of the POS. If it is wrong, everything built on top of it will feel wrong. The navigation must reduce the distance between the operator's intent and the action that fulfills it.

### 9.1 Primary Navigation — Sidebar

The sidebar is the structural spine of the application. It is **always visible** on desktop/tablet and **collapsible** on smaller screens.

**Collapsed State** (72px width):
- Icon only, centered vertically in each nav item
- Active item indicated by a 3px left border in `accent-positive` and a `surface-raised` background
- Tooltip on hover (appears after 300ms delay, 200ms fade-in)

**Expanded State** (240px width):
- Icon + label, left-aligned with 12px icon-to-text gap
- Active item indicated by a 3px left border in `accent-positive`, `surface-raised` background, and `text-primary` label color (inactive items use `text-tertiary`)
- Sub-items appear below parent with 16px left indent

**Transition**: 300ms `ease-in-out` on width. Content fades in at 150ms delay.

**Sidebar background**: Dark glassmorphism on `accent-action` base:

```css
background: rgba(17, 24, 39, 0.95);
backdrop-filter: blur(16px);
border-right: 1px solid rgba(255, 255, 255, 0.08);
```

**Nav Item Dimensions**:
- Height: 48px
- Padding: 12px 24px (expanded), 12px (collapsed — centers icon)
- Gap between items: 4px
- Icon size: 24px
- Label: `body` (14px, 400), inactive: `text-tertiary`, active: `text-primary`

**Section Dividers** in sidebar: 1px `rgba(255,255,255,0.08)` with 8px top/bottom margin.

### 9.2 Secondary Navigation — Contextual Tabs

Within each primary section, secondary navigation uses horizontal tabs.

**Tab Design**:
- Inactive: `surface-raised` background, `text-secondary` color, `radius-md`
- Active: `accent-action` background, `#FFFFFF` text, `radius-md`
- Hover (inactive only): `surface-muted` background
- Height: 36px
- Padding: 8px 16px
- Gap between tabs: 8px
- Font: `body-small` (13px, 500)

**Tab Bar Container**: Horizontal scrollable if tabs exceed viewport width. Scroll indicators (chevrons) appear when overflow exists. Background is `surface-base` with `elevation-1` bottom shadow when content scrolls beneath.

### 9.3 Tertiary Navigation — Breadcrumbs & Back Actions

For deeply nested flows (e.g., Order → Item → Modifiers → Special Instructions):

- **Breadcrumb**: `text-tertiary` labels separated by `/` in `caption` size. Current level is `text-secondary`. Each previous level is a clickable link that transitions `color` on hover.
- **Back button**: Left arrow icon + "Back" label, positioned at the top-left of the content area. Uses `text-secondary` color. The back button is preferred over breadcrumbs for simple two-level depth.

### 9.4 Quick Actions Bar

A persistent floating bar at the bottom of the main content area (above the order summary if present) for context-sensitive quick actions.

**Design**:
- Glassmorphic panel (Layer 1 spec)
- Height: 56px
- Contains 3-5 action buttons
- Actions change based on current context (e.g., on the orders screen: "New Order", "Search Order", "Filter by Status")
- Buttons use `radius-pill` with icon + label
- Primary action is visually emphasized with `accent-action` background
- Secondary actions use `surface-base` background with `border-subtle`

---

## 10. Component Specifications

Every component in this system is designed for the specific demands of a restaurant POS — fast interaction, high density, zero ambiguity.

### 10.1 Menu Item Card

The menu item card is the most-tapped component in the entire system. It must be scannable, tappable, and immediately communicative.

**Default State**:
```
+-------------------------------------------+
|  [Image 80x80]   Item Name                |
|                  Short description...      |
|                  $ 14.50  [Vegetarian]     |
+-------------------------------------------+
```

- Background: `surface-base`
- Border: 1px `border-subtle`
- Border radius: `radius-lg` (12px)
- Padding: 12px
- Image: 80x80px, `radius-md` (8px), `object-fit: cover`
- Item Name: `heading-3` (18px, 600), `text-primary`, single line with ellipsis
- Description: `body-small` (13px, 400), `text-tertiary`, single line with ellipsis
- Price: `price` (16px, 600), `text-primary`, monospace
- Tags (Vegetarian, Spicy): `caption` (12px, 500) in pill badges

**Selected State** (item added to order):
- Background: `accent-positive-light`
- Border: 2px `accent-positive`
- A small checkmark icon appears at the top-right corner
- Quantity indicator appears at the bottom-right

**Unavailable State**:
- Background: `surface-muted`
- Opacity: 0.6
- A "Sold Out" ribbon covers the image corner
- Tap does nothing (no animation, no response — silence is the clearest "no")

**Hover State**:
- `elevation-2` shadow
- Subtle scale: `transform: scale(1.01)` over 150ms
- Border: 1px `border-medium`

### 10.2 Category Filter Bar

Horizontal scrollable row of category pills above the menu grid.

- Container: Glassmorphic (Layer 1), `radius-xl`, `elevation-1`
- Pill (inactive): `surface-raised` background, `text-secondary`, `radius-pill`, 1px `border-subtle`
- Pill (active): `accent-action` background, `#FFFFFF` text, `radius-pill`, no border
- Pill height: 36px
- Pill padding: 8px 16px
- Gap between pills: 8px
- Scroll chevrons: 24px circular buttons at each end, `surface-raised` background, visible only when content overflows

### 10.3 Order Ticket / Current Order Panel

The order panel is the right-side companion that shows what the customer is ordering. It is always visible on the order screen.

**Panel Container**:
- Background: `surface-base`
- Left border: 1px `border-subtle`
- No border radius (it is a full-height panel, not a floating card)
- Padding: `space-4` (16px)

**Header**:
- Table/Order number: `heading-2` (22px, 600)
- Order type badge (Dine-in / Takeaway / Delivery): pill badge, `caption` size
- Time since order started: `caption`, `text-tertiary`

**Order Item Row**:
```
+--------------------------------------------------+
| 2x   Item Name                          $ 29.00   |
|      + Extra cheese, No onions                   |
|      [Note icon] "No salt please"                |
+--------------------------------------------------+
```

- Height: auto (expands with modifiers), minimum 52px
- Padding: 12px 0
- Border bottom: 1px `border-subtle`
- Quantity: `heading-3` (18px, 600), `accent-positive`, 32px wide right-aligned
- Item name: `body` (14px, 500), `text-primary`
- Price: `price` (16px, 600), `text-primary`, right-aligned, monospace
- Modifiers: `body-small` (13px, 400), `text-tertiary`, indented 32px
- Notes: `body-small` (13px, 400 italic), `accent-warm`, indented 32px, preceded by note icon

**Total Section**:
- Top border: 2px `text-primary`
- Padding: 16px 0 8px
- Subtotal: `body` (14px, 500), `text-secondary` label, `price` value
- Tax: `body` (14px, 400), `text-tertiary` label, `price` value
- Discount (if any): `body` (14px, 500), `accent-promo` label and value
- Grand Total: `heading-1` (28px, 700), `text-primary` label, `price-display` value

### 10.4 Table Map Card

Visual representation of a table on the floor plan.

**Default (Available)**:
- Background: `accent-positive-light`
- Border: 2px `accent-positive`
- Table number: `heading-3` (18px, 600), `accent-positive`, centered
- Capacity: `caption` (12px, 400), `accent-positive`, below number
- Shape: Rounded rectangle for rectangular tables, circle for round tables
- `radius-lg` for rectangles, `radius-circle` for round

**Occupied**:
- Background: `accent-warm-light`
- Border: 2px `accent-warm`
- Table number + order count: `heading-3` + `caption`
- Time seated: `caption`, `accent-warm`

**Reserved**:
- Background: `surface-raised`
- Border: 2px `border-medium` dashed
- Table number: `heading-3`, `text-tertiary`
- Reservation time: `caption`, `text-tertiary`

**Overdue** (occupied beyond expected duration):
- Background: `accent-urgency-light`
- Border: 2px `accent-urgency`
- Pulse animation: subtle 2s infinite pulse on the border
- Table number: `heading-3`, `accent-urgency`
- Time over: `caption`, `accent-urgency`

### 10.5 Payment Screen Components

**Payment Amount Display**:
- Centered at the top of the payment view
- Total amount: `price-display` (36px, 800), `text-primary`
- "Total" label: `heading-3` (18px, 400), `text-tertiary`, above the amount
- Background: `surface-base`, no border, generous padding (32px)

**Payment Method Selector**:
- Horizontal row of payment method cards
- Card dimensions: 96 x 72px
- Card (unselected): `surface-raised`, 1px `border-subtle`, `radius-lg`, payment icon centered, method label in `caption` below
- Card (selected): `accent-action` background, `#FFFFFF` icon and label, 2px `accent-action` border, `elevation-2`
- Gap between cards: 12px

**Tip Selector**:
- Horizontal row of pill buttons: 15% / 18% / 20% / Custom
- Pill (unselected): `surface-raised`, `text-secondary`, `radius-pill`
- Pill (selected): `accent-positive`, `#FFFFFF`, `radius-pill`
- Custom: Opens a number input modal

**Split Bill Toggle**:
- Toggle switch with "Split Evenly" / "Split by Item" options
- Uses `accent-positive` for active toggle

### 10.6 Status Badge

Small, colored indicators for order/item states.

| State | Background | Text Color | Text | Radius |
|---|---|---|---|---|
| New | `accent-positive-light` | `accent-positive` | NEW | `radius-pill` |
| In Progress | `accent-warm-light` | `accent-warm` | IN PROGRESS | `radius-pill` |
| Ready | `accent-positive-light` | `accent-positive` | READY | `radius-pill` |
| Served | `surface-muted` | `text-tertiary` | SERVED | `radius-pill` |
| Voided | `accent-urgency-light` | `accent-urgency` | VOIDED | `radius-pill` |
| Discounted | `accent-promo-light` | `accent-promo` | DISCOUNT | `radius-pill` |
| Modified | `accent-warm-light` | `accent-warm` | MODIFIED | `radius-pill` |

Badge styling: `caption` (12px, 600), padding 4px 10px, `radius-pill`.

### 10.7 Modal / Dialog

**Container**:
- Glassmorphic (Layer 2 spec)
- Width: 480px (standard), 640px (wide), 360px (compact)
- Max height: 80vh, scrollable content area
- Header: `heading-2` title, close button (X icon, 40x40px, top-right)
- Content: `space-4` padding
- Footer: Action buttons right-aligned, primary + secondary

**Overlay**:
- `rgba(0, 0, 0, 0.30)` with `backdrop-filter: blur(4px)`
- Click outside to dismiss for non-destructive modals
- Click outside does NOT dismiss for destructive confirmations (void, cancel)

**Entry Animation**:
- Scale from 0.95 to 1.0, opacity from 0 to 1, 200ms `ease-out`
- Overlay fade: 150ms

**Exit Animation**:
- Scale from 1.0 to 0.95, opacity from 1 to 0, 150ms `ease-in`
- Overlay fade: 100ms

### 10.8 Toast / Notification

**Container**:
- Glassmorphic (Layer 3 spec)
- Position: Top-right, 16px from edge
- Width: 360px max
- Padding: 12px 16px
- `radius-lg`

**Types**:
- Success: Left accent bar 3px `accent-positive`, `accent-positive` icon
- Error: Left accent bar 3px `accent-urgency`, `accent-urgency` icon
- Warning: Left accent bar 3px `accent-warm`, `accent-warm` icon
- Info: Left accent bar 3px `text-tertiary`, info icon

**Animation**:
- Slide in from right: `transform: translateX(100%) → translateX(0)`, 300ms `ease-out`
- Auto-dismiss after 4s (success), 6s (error), 5s (warning/info)
- Dismiss: slide out to right, 200ms `ease-in`

### 10.9 Input Fields

**Standard Input**:
- Height: 44px
- Background: `surface-base`
- Border: 1px `border-subtle`
- Border radius: `radius-md` (8px)
- Padding: 12px 16px
- Font: `body` (14px, 400), `text-primary`
- Placeholder: `text-quaternary`

**Focus State**:
- Border: 2px `accent-positive`
- Ring: `0 0 0 3px rgba(5,150,105,0.15)`
- No shadow change

**Error State**:
- Border: 2px `accent-urgency`
- Ring: `0 0 0 3px rgba(220,38,38,0.15)`
- Error message below: `caption` (12px, 400), `accent-urgency`

**Disabled State**:
- Background: `surface-muted`
- Text: `text-quaternary`
- Border: 1px `border-subtle`
- Cursor: `not-allowed`

**Number Input (for quantities, prices)**:
- Same as standard input but with stepper buttons (minus/plus) inside the field on the right side
- Stepper buttons: 32x32px, `surface-raised`, `radius-sm`, icon-only

**Search Input**:
- Left search icon (16px, `text-tertiary`)
- Right clear button (X, appears when input has value)
- Height: 40px
- `radius-pill` for softer, friendlier search feel

### 10.10 Buttons

**Primary Button** (main action — Pay, Send Order, Confirm):
```css
background: #111827;
color: #FFFFFF;
border: none;
border-radius: 8px; /* radius-md */
padding: 12px 24px;
font: 600 14px/1 Inter;
box-shadow: 0 2px 4px rgba(0,0,0,0.10);
```
- Hover: `background: #1F2937`, `elevation-2`
- Active/Pressed: `background: #111827`, `elevation-0`, `transform: scale(0.98)`
- Disabled: `background: surface-muted`, `color: text-quaternary`, no shadow

**Secondary Button** (alternative action — Cancel, Back, Skip):
```css
background: #FFFFFF;
color: #111827;
border: 1px solid #E5E7EB;
border-radius: 8px;
padding: 12px 24px;
font: 500 14px/1 Inter;
```
- Hover: `background: #FAFAFA`, `border-color: #D1D5DB`
- Active/Pressed: `background: #F3F4F6`
- Disabled: `color: text-quaternary`, `border-color: transparent`

**Ghost Button** (tertiary action, low emphasis):
```css
background: transparent;
color: #374151;
border: none;
border-radius: 8px;
padding: 12px 24px;
font: 500 14px/1 Inter;
```
- Hover: `background: #F3F4F6`
- Active/Pressed: `background: #E5E7EB`

**Icon Button** (toolbar actions, compact spaces):
- Size: 40x40px
- Background: transparent
- Icon: 20px, `text-secondary`
- Border radius: `radius-md` (8px)
- Hover: `surface-muted` background
- Active: `surface-raised` background, icon `text-primary`

**Destructive Button** (Void, Delete, Cancel Order):
```css
background: #DC2626;
color: #FFFFFF;
border: none;
border-radius: 8px;
padding: 12px 24px;
font: 600 14px/1 Inter;
```
- Always requires confirmation step
- Never the default focused button in a modal

**Pill CTA Button** (for category filters, quick actions):
```css
background: #111827;
color: #FFFFFF;
border: none;
border-radius: 9999px;
padding: 8px 20px;
font: 500 13px/1 Inter;
```

### 10.11 Modifier / Customization Panel

When a menu item is tapped and requires customization, a bottom sheet slides up.

**Bottom Sheet**:
- Height: 60-80% of viewport (depending on modifier count)
- Background: Glassmorphic (Layer 2 spec)
- Top edge: `radius-2xl` (20px) with a 4px x 32px drag handle centered at the top
- Header: Item name (`heading-2`), price (`price-large`), close button
- Body: Scrollable list of modifier groups, each with a group title and selectable options
- Modifier option: Row with name, price delta (+$2.00), and radio/checkbox
- Footer: "Add to Order — $XX.XX" primary button, full width

**Modifier Group**:
- Title: `heading-3` (18px, 600), `text-primary`
- Required indicator: Red asterisk or "Required" badge
- Max selection indicator: "Choose up to 3" in `caption`, `text-tertiary`

**Modifier Option Row**:
- Height: 44px minimum
- Name: `body` (14px, 400), `text-primary`
- Price delta: `body-small` (13px, 400), `text-tertiary`, right-aligned, monospace
- Selection indicator: Radio for single-select, checkbox for multi-select
- Selected state: `accent-positive` indicator

---

## 11. Screen Blueprints

These blueprints describe the structure and content hierarchy of every major screen in the POS system. They are not pixel-perfect layouts — they are information architecture that any agent can render using the component specifications above.

### 11.1 Dashboard / Home Screen

**Purpose**: At-a-glance overview of the restaurant's current state. The operator should understand the full operational picture in under 3 seconds.

**Layout**:
```
+------------------+---------------------------------------------+
| SIDEBAR          |  [Header: "Good Evening, [Name]" + Time]     |
|                  |  [Quick Stats Row]                           |
|   Dashboard      |   [Orders Today] [Revenue] [Avg Time] [Open] |
|   Orders         |                                              |
|   Menu           |  [Main Grid: 2x2]                            |
|   Tables         |   [Active Orders List]  [Table Map Mini]      |
|   Payments       |   [Revenue Chart]       [Alerts/Notifications]|
|   Kitchen        |                                              |
|   Staff          |  [Quick Actions Bar]                         |
|   Reports        |   [New Order] [Search] [Filter]              |
|   Settings       |                                              |
+------------------+---------------------------------------------+
```

**Quick Stats Cards**:
- 4 cards in a row, each showing: Label (`caption`), Value (`display`), Trend indicator (arrow up/down with percentage)
- Background: Glassmorphic (Layer 3) with left accent bar (4px) in context color
- Positive metrics: `accent-positive` accent bar
- Negative metrics: `accent-urgency` accent bar
- Neutral metrics: `accent-warm` accent bar

**Active Orders List**: Shows the 5 most recent active orders with status badges, table numbers, and time elapsed. Each row is tappable → navigates to order detail.

**Table Map Mini**: Compact version of the floor plan showing table statuses as colored dots/squares. Tappable → navigates to full table map.

**Revenue Chart**: Minimal sparkline-style chart for today's revenue. No axis labels, just the trend line with the current total.

**Alerts Panel**: List of items needing attention (low stock, overdue tables, kitchen delays). Each alert has an icon, message, and action link.

### 11.2 Order Entry Screen

**Purpose**: The most-used screen. Operators select menu items, customize them, and build an order as fast as possible.

**Layout** (Two-Column):
```
+------------------+---------------------------+-------------------+
| SIDEBAR          | MENU AREA (60%)           | ORDER PANEL (40%) |
|                  |                           |                   |
|                  | [Search Bar]              | [Table 7 - Dine]  |
|                  | [Category Filter Bar]     |                   |
|                  |                           | [Order Item 1]    |
|                  | [Menu Grid]               | [Order Item 2]    |
|                  |  [Card] [Card] [Card]     | [Order Item 3]    |
|                  |  [Card] [Card] [Card]     |                   |
|                  |  [Card] [Card] [Card]     | [Subtotal]        |
|                  |  [Card] [Card] [Card]     | [Tax]             |
|                  |                           | [Discount]        |
|                  |                           | [GRAND TOTAL]     |
|                  |                           |                   |
|                  |                           | [Send to Kitchen] |
|                  |                           | [Pay]             |
+------------------+---------------------------+-------------------+
```

**Menu Grid**: 3-4 columns of menu item cards. Grid gap: 12px. Scrollable vertically. Category filter bar is sticky at top.

**Search**: Appears above the category bar. When focused, the category bar dims and search results replace the menu grid in real-time.

**Order Panel**: Fixed on the right. Does not scroll the order items list (it scrolls independently). Always shows the totals and action buttons at the bottom.

### 11.3 Table Management Screen

**Purpose**: Visual floor plan for managing table status, seating, and linking orders to tables.

**Layout**:
```
+------------------+---------------------------------------------+
| SIDEBAR          | [Header: "Floor Plan" + Section Tabs]        |
|                  |  [Main Floor] [Patio] [Bar] [Private]       |
|   Dashboard      |                                              |
|   Orders         | [Floor Plan Canvas]                         |
|   Menu           |  [Table]  [Table]      [Table]              |
|   Tables ←       |       [Table]    [Table]                    |
|   Payments       |  [Table]     [Table]  [Table]              |
|   Kitchen        |                                              |
|   Staff          | [Selected Table Detail Panel - Bottom Sheet] |
|   Reports        |  Table 7 | 4 guests | Seated 45m           |
|   Settings       |  [View Order] [Transfer] [Close Table]       |
+------------------+---------------------------------------------+
```

**Floor Plan Canvas**: Full-width interactive area where tables are positioned according to the restaurant's actual layout. Tables are draggable by managers (in edit mode).

**Table Detail Panel**: Bottom sheet that appears when a table is selected. Shows table info, current order (if any), and action buttons.

### 11.4 Kitchen Display Screen

**Purpose**: Shows active orders to kitchen staff in priority order. Must be readable from 3+ feet away.

**Layout**:
```
+---------------------------------------------------------------+
| [Header: "Kitchen Display" + Timer]                           |
|                                                                |
| [Order Column 1]  [Order Column 2]  [Order Column 3]  [...]   |
|  +-----------+     +-----------+     +-----------+            |
|  | #1024     |     | #1025     |     | #1026     |            |
|  | Table 7   |     | Takeout   |     | Table 3   |            |
|  | 12:34     |     | 12:36     |     | 12:38     |            |
|  |-----------|     |-----------|     |-----------|            |
|  | 2x Burger |     | 1x Salad  |     | 3x Pasta  |            |
|  |  - No mayo|     |  + Chicken|     |  - Cheese |            |
|  | 1x Fries  |     |           |     |  1x Soup  |            |
|  |-----------|     |-----------|     |-----------|            |
|  | [DONE]    |     | [DONE]    |     | [DONE]    |            |
|  +-----------+     +-----------+     +-----------+            |
+---------------------------------------------------------------+
```

**Special Kitchen Display Rules**:
- Font sizes are 1.5x larger than standard POS screens for distance readability
- Order time color coding: < 10m = `text-secondary`, 10-20m = `accent-warm`, > 20m = `accent-urgency` with pulse
- "DONE" button is the largest touch target on the card
- Cards have left color bar: `accent-positive` for new, `accent-warm` for in-progress, `accent-urgency` for overdue
- No glassmorphism on kitchen display — solid, high-contrast surfaces for maximum readability under kitchen lighting

### 11.5 Payment Screen

**Purpose**: Complete a transaction with clarity and confidence. The customer may be watching.

**Layout**:
```
+------------------+---------------------------------------------+
| SIDEBAR          | [Header: "Payment" + Back Arrow]             |
|                  |                                              |
|                  |          [Total Amount - Large]              |
|                  |          $ 86.50                             |
|                  |                                              |
|                  | [Payment Methods Row]                        |
|                  |  [Cash] [Card] [Mobile] [Split]             |
|                  |                                              |
|                  | [Tip Selection]                              |
|                  |  [15%] [18%] [20%] [Custom]                 |
|                  |                                              |
|                  | [Order Summary - Collapsible]                |
|                  |  Item 1 .......................... $ 14.50   |
|                  |  Item 2 .......................... $ 29.00   |
|                  |  ...                                         |
|                  |                                              |
|                  | [Process Payment - Primary CTA, full width]  |
+------------------+---------------------------------------------+
```

**Payment Amount**: Centered, dominant, `price-display` size. This is the most important piece of information on the screen.

**Payment Method Cards**: Large enough to tap confidently. Visual feedback on selection is immediate.

**Process Payment Button**: Full-width, primary button style, height: 56px. After tap, shows a brief loading spinner (1-2s), then transitions to success screen.

**Success State**:
- Full-screen overlay with `accent-positive-light` background
- Large checkmark animation (drawn stroke, 500ms)
- "Payment Successful" in `heading-1`
- Amount in `price-display`
- Receipt options: [Print Receipt] [Email Receipt] [No Receipt]
- Auto-returns to dashboard after 10 seconds or on tap

### 11.6 Staff Management Screen

**Purpose**: Clock in/out, assign roles, manage shifts.

**Layout**:
```
+------------------+---------------------------------------------+
| SIDEBAR          | [Header: "Staff" + Date Selector]            |
|                  |                                              |
|                  | [Currently Active Staff]                     |
|                  |  [Avatar] Name - Role - Clocked in 3h 24m    |
|                  |  [Avatar] Name - Role - Clocked in 1h 12m    |
|                  |                                              |
|                  | [Shift Schedule - Timeline View]             |
|                  |  [8:00 ----|----|---- 16:00]                 |
|                  |       [9:00 ----|---- 17:00]                  |
|                  |                                              |
|                  | [Clock In/Out - Large CTA]                   |
+------------------+---------------------------------------------+
```

### 11.7 Reports Screen

**Purpose**: View business analytics. Not time-pressured — this is a "sit and think" screen, not a "tap and go" screen.

**Layout**:
```
+------------------+---------------------------------------------+
| SIDEBAR          | [Header: "Reports" + Date Range Picker]      |
|                  |                                              |
|                  | [KPI Cards Row]                              |
|                  |  [Revenue] [Orders] [Avg Ticket] [Top Item]  |
|                  |                                              |
|                  | [Chart Area - Toggle between views]          |
|                  |  [Revenue Trend Line Chart]                  |
|                  |                                              |
|                  | [Detailed Table]                             |
|                  |  Item | Qty | Revenue | % of Total           |
|                  |  ...                                         |
+------------------+---------------------------------------------+
```

**Reports-specific design**:
- More white space than operational screens (this is analytical, not transactional)
- Charts use the accent color system: `accent-positive` for growth, `accent-urgency` for decline
- Table rows are zebra-striped with `surface-raised` on alternate rows
- Export buttons in the header: [PDF] [CSV] [Print]

---

## 12. Interaction & Animation Language

Animations are not decoration — they are communication. They tell the user what just happened, what is happening, and what will happen next. Every animation must serve one of these purposes. If it does not, remove it.

### 12.1 Motion Principles

1. **Purposeful**: Every animation communicates a state change. No animation exists purely for visual flair.
2. **Quick**: Interactions complete in 150-300ms. The user should never wait for an animation to finish before proceeding.
3. **Natural**: Use `ease-out` for entries (fast start, gentle finish), `ease-in` for exits (gentle start, fast finish). This mirrors physical objects entering and leaving our attention.
4. **Consistent**: The same interaction always produces the same animation. A modal always enters with the same timing and easing.

### 12.2 Standard Durations

| Animation Type | Duration | Easing | Usage |
|---|---|---|---|
| Micro-feedback (button press, toggle) | 100ms | `ease-out` | Immediate tactile response |
| State transition (hover, focus, color change) | 150ms | `ease-in-out` | Smooth but noticeable |
| Entry animation (modal, panel, dropdown) | 200ms | `ease-out` | Fast arrival, gentle settle |
| Exit animation (modal close, panel dismiss) | 150ms | `ease-in` | Quick departure |
| Layout shift (sidebar expand, panel resize) | 300ms | `ease-in-out` | Smooth spatial reorganization |
| Page transition | 250ms | `ease-in-out` | Content crossfade |
| Success celebration (checkmark draw) | 500ms | `cubic-bezier(0.65, 0, 0.35, 1)` | Deliberate, satisfying |
| Error shake | 400ms (4 oscillations) | `ease-in-out` | Attention-grabbing urgency |

### 12.3 Specific Animation Patterns

**Item Added to Order**:
- Card brief flash of `accent-positive-light` background (200ms)
- Small "+1" badge appears at the card's top-right, scales up from 0 to 1 (150ms), then fades out (300ms after 500ms hold)
- Order panel item slides in from right (200ms, `ease-out`)
- Grand total animates the number change (counter animation, 300ms)

**Item Removed from Order**:
- Order panel item slides out to right (150ms, `ease-in`)
- Brief flash of `accent-urgency-light` on the removed row (150ms)

**Order Sent to Kitchen**:
- Entire order panel items do a subtle "lift and settle" (translateY -4px then back, 200ms)
- "Sent to Kitchen" toast appears top-right
- "KDS #1024" badge appears on the kitchen display in real-time

**Payment Processing**:
- Button text changes to spinner (immediately on click)
- Spinner rotates for 1-3s
- On success: Button transforms to green checkmark (scale bounce: 1.0 → 1.2 → 1.0, 300ms)
- Entire screen transitions to success overlay (fade, 300ms)

**Table Status Change**:
- Color transitions are animated (300ms, `ease-in-out`)
- Overdue pulse: `box-shadow` pulses from 0 to 4px `accent-urgency` opacity, 2s infinite

### 12.4 Reduced Motion

All animations must respect `prefers-reduced-motion: reduce`. When reduced motion is preferred:
- Replace all animations with instant state changes (0ms duration)
- Keep color changes (they are not motion)
- Remove particle effects, counter animations, and celebration animations
- Maintain functional feedback through color and shape changes only

---

## 13. State Management Patterns

### 13.1 Loading States

- **Skeleton screens** for content areas: Use `surface-muted` rectangles with a subtle shimmer animation (linear gradient moving left to right, 1.5s infinite)
- **Inline spinners** for button actions: Replace button text with a 20px spinner in the button's text color
- **Never** use full-page loading spinners. The POS must always show something useful.

### 13.2 Empty States

When a section has no content, show an empty state that guides the user forward.

**Structure**:
- Illustration/icon (48-64px, `text-quaternary`)
- Title (`heading-3`, `text-secondary`): e.g., "No Active Orders"
- Description (`body`, `text-tertiary`): e.g., "When orders come in, they will appear here."
- Action button (secondary style): e.g., "Create First Order"

**Tone**: Encouraging, not discouraging. "Let's get started" not "Nothing here."

### 13.3 Error States

- **Inline errors** for form fields: Red border + error message below field (see Section 10.9)
- **Toast errors** for system errors: Error toast with icon and message (see Section 10.8)
- **Full-page errors** for catastrophic failures: Centered icon + message + retry button
- **Never** show raw error codes to the user. Always translate to human-readable messages.
- **Always** provide a next action. An error without a path forward creates helplessness.

### 13.4 Offline State

Restaurant POS systems must handle connectivity loss gracefully.

- When offline: A persistent yellow banner at the top: "Offline — Changes will sync when connected"
- All critical operations (creating orders, processing payments) must work offline with local storage
- When reconnected: Green toast "Back online — Syncing changes..." then "All changes synced"
- Data conflicts: Resolve silently when possible; prompt only when user intervention is required

---

## 14. Accessibility & Readability

### 14.1 Contrast Ratios

- All text must meet WCAG AA minimum contrast ratios
- `text-primary` on `surface-base`: 15.4:1 (exceeds AAA)
- `text-secondary` on `surface-base`: 9.2:1 (exceeds AAA)
- `text-tertiary` on `surface-base`: 4.6:1 (meets AA)
- `text-quaternary` on `surface-base`: 3.1:1 (decorative only — never used for meaningful information)
- Accent colors on white: `accent-positive` at 4.6:1, `accent-urgency` at 5.4:1, `accent-promo` at 4.5:1
- White text on `accent-action`: 15.4:1

### 14.2 Touch Accessibility

- Minimum touch target: 44x44px (WCAG 2.5.5)
- Preferred touch target for primary actions: 48x48px
- Touch targets separated by minimum 8px horizontal, 4px vertical
- No time-based interactions (no hover-only content, no auto-advancing carousels)

### 14.3 Screen Reader Support

- All interactive elements have accessible labels
- Status changes are announced via `aria-live` regions
- Icon-only buttons have `aria-label` attributes
- Modal dialogs trap focus and return focus on close
- Order totals are announced when they change

### 14.4 High-Legibility Mode

For kitchen display and outdoor counter use where lighting is challenging:
- Toggle available in settings: "High Legibility Mode"
- Increases all font sizes by 25%
- Increases contrast by using pure black (#000000) for all text
- Removes glassmorphism (solid backgrounds only)
- Increases border thickness by 50%
- Disables all non-essential animations

---

## 15. Anti-Patterns — What Never To Do

This section exists because knowing what NOT to do is as important as knowing what to do. These are violations of the design language that would break the system's coherence.

### 15.1 Visual Anti-Patterns

- **NEVER** use gradients as backgrounds for content areas. Gradients are reserved for hero images and promotional banners only.
- **NEVER** use more than 3 accent colors on a single screen. If you need more, the screen is doing too much.
- **NEVER** use pure black (#000000) as a background for content areas — it creates too much contrast and causes eye strain. Use `accent-action` (#111827) which has a hint of warmth.
- **NEVER** place text over images without a scrim/overlay. Readability trumps aesthetics.
- **NEVER** use decorative borders (double lines, dotted lines, ornamental dividers). Borders are structural, not decorative.
- **NEVER** mix icon styles within the same context. If one icon is outlined, all icons in that group are outlined.
- **NEVER** use shadows as the sole differentiator between elements. Always pair shadows with other visual cues (background color, border).
- **NEVER** animate text (no text fade-ins, no typewriter effects, no text scaling). Text must appear instantly and be readable immediately.

### 15.2 Interaction Anti-Patterns

- **NEVER** require a double-tap or long-press for critical actions. If it matters, it should be one tap away.
- **NEVER** auto-advance screens or auto-submit forms. The user must always be in control.
- **NEVER** hide the order total. It must always be visible during the ordering flow.
- **NEVER** remove the back/undo option without a confirmation dialog.
- **NEVER** show a modal on top of another modal. If a second confirmation is needed, replace the first modal's content.
- **NEVER** use infinite scroll for order lists. Paginate or use a "Load More" button. The operator needs to know where things are.

### 15.3 Content Anti-Patterns

- **NEVER** use lorem ipsum or placeholder content. Every element in the design should represent real data.
- **NEVER** abbreviate words unless the abbreviation is universally understood in the restaurant context (POS, KDS, VIP, GST). "Qty" is acceptable; "Qntty" is not.
- **NEVER** use jargon from other domains. This is a restaurant POS, not a banking app. "Refund" not "Reversal," "Cancel" not "Abrogate."
- **NEVER** show decimals in quantities. 1, not 1.00. But always show decimals in prices: $12.50, not $12.5.
- **NEVER** display negative numbers without context. A negative amount must be labeled (Discount, Refund, Void) and visually marked.

### 15.4 Architecture Anti-Patterns

- **NEVER** hardcode brand names, restaurant names, or specific business logic into the design system. The system must work for any restaurant.
- **NEVER** make layout decisions based on a specific screen size. Design for a range (768px tablet to 1920px desktop).
- **NEVER** create a screen that requires horizontal scrolling. The POS viewport is fixed; all content must fit or scroll vertically.
- **NEVER** put critical status information (kitchen queue depth, open order count) more than one tap away from the home screen.

---

## 16. Design Decision Rationale Index

When implementing any screen, the designer/agent should reference this index to understand WHY each decision was made. This prevents drift — the slow degradation of design quality that happens when people forget the reasoning.

| Decision | Rationale | Principle |
|---|---|---|
| White backgrounds for content | Reduces eye strain during long shifts; creates visual cleanliness that reduces stress | Cognitive Load |
| Dark sidebar | Creates clear structural separation; dark nav is perceived as "fixed infrastructure" while light content is "working area" | Figure-Ground |
| Glassmorphism for overlays | Maintains spatial context while focusing attention; the blurred background tells the user "your stuff is still there" | Continuity |
| Green for confirmed/positive | Universal "go" signal; works across cultures; high visibility in peripheral vision | Color Psychology |
| Pill-shaped primary CTAs | The fully-rounded shape is the most approachable form; it draws the eye and invites interaction | Affordance |
| Monospace for prices | Numbers in proportional fonts misalign; tabular figures ensure columns read correctly at speed | Hick's Law (reducing decision time) |
| Left-aligned text | Center-aligned text creates ragged left edges that slow reading; left alignment creates a clean scan line | Reading Efficiency |
| 8px grid system | Multiples of 8 create mathematical harmony; the brain perceives the rhythm as "order" even unconsciously | Gestalt Similarity |
| Subtle hover states | Hover provides feedback without committing; the gentle response says "I see you, I'm ready" | Behavioral Design |
| Confirmation for destructive actions | Prevents costly mistakes; the extra tap creates a moment of deliberate intent | Error Prevention |
| Toast notifications for success | Success feedback should not interrupt flow; toasts acknowledge without blocking | Non-blocking Feedback |
| Persistent order panel | The current order must always be visible; hiding it creates anxiety and errors | Cognitive Load |
| Category pills in scrollable bar | More categories than fit on screen; horizontal scroll keeps them accessible without taking vertical space | Progressive Disclosure |
| Bottom sheet for modifiers | Contextual editing without navigating away; the sheet is close to the item and dismissable with a swipe | Proximity |
| Animated number changes | Counter animations draw attention to the changed value; without them, users miss the update | Attention Direction |
| Warm accent colors in food contexts | Warm colors (orange, amber) stimulate appetite and create comfort; cool colors suppress appetite | Color Psychology |
| Large touch targets (48px) | Restaurant environments involve wet hands, gloves, and haste; generous targets prevent mis-taps | Fitts's Law |
| Status badges over status text | Badges are scannable at a glance; reading "READY" is slower than perceiving a green pill | Preattentive Processing |
| Dark footer in glass panels | A dark bottom edge grounds the panel visually; it prevents the "floating away" feeling | Visual Weight |
| 2px border radius on icons | Matches the broader radius system at micro scale; creates consistency from icon to page | Gestalt Similarity |

---

## Implementation Notes for Agents

When you are given a prompt to build a screen or component for this restaurant POS system:

1. **Read the relevant Screen Blueprint** (Section 11) to understand the information architecture.
2. **Select the correct components** (Section 10) for each element in the blueprint.
3. **Apply the correct colors** (Section 2) — never guess; always use the token system.
4. **Apply glassmorphism** (Section 3) only where specified — never on primary content cards.
5. **Follow the spacing grid** (Section 5) — every measurement is a multiple of 4px.
6. **Use the typography scale** (Section 4) — never invent a font size.
7. **Apply animations** (Section 12) only where they serve a purpose — never for decoration.
8. **Check anti-patterns** (Section 15) before finalizing — if you've violated any, redesign.
9. **Verify the psychological rationale** (Section 1 and Section 16) — if a design decision cannot be traced to a principle, it should not exist.

The goal is not to follow rules mechanically. The goal is to internalize the principles so deeply that every pixel you place feels inevitable — as if no other design decision could possibly be correct. When you achieve that, the interface will feel like it was designed by people who understand not just how software works, but how people work.

---

*This design system is a living document. As the restaurant POS evolves, every addition must trace back to the foundational psychology in Section 1. If a new component, color, or pattern cannot be justified through these principles, it does not belong in this system.*
