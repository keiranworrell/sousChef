# sousChef Style Guide

This document defines the visual and interaction language for sousChef across web and mobile.
All UI work — new features, components, and screens — must follow these guidelines.
When in doubt, favour simplicity and restraint.

---

## Core Principles

**Food is the hero.** The UI's job is to get out of the way and let the recipe — its photo, its title, its story — do the work. Avoid decorative elements that compete with content.

**Progressive disclosure.** Show the minimum useful information first. Let users pull more detail when they want it. A recipe card should make you want to cook something; the detail view tells you how.

**Functional minimalism.** Every element on screen should earn its place. If removing it doesn't break anything, remove it. Whitespace is not wasted space.

**Consistent across platforms.** Web and mobile will have different interaction patterns (hover vs tap, navigation paradigms) but must share the same colour palette, type scale, spacing system, and component vocabulary. A user who switches between platforms should feel at home immediately.

---

## Colour

### Brand

| Token | Hex | Usage |
|---|---|---|
| `orange-500` | `#f97316` | Primary actions, links, active states, key highlights |
| `orange-600` | `#ea6c0a` | Hover state for primary buttons |
| `orange-100` | `#ffedd5` | Tinted backgrounds, badge fills, subtle highlights |
| `orange-50` | `#fff7ed` | Very subtle tint, hover backgrounds |

### Neutrals (Light Mode)

| Token | Hex | Usage |
|---|---|---|
| `white` | `#ffffff` | Card backgrounds, input backgrounds |
| `gray-50` | `#f9fafb` | App/page background |
| `gray-100` | `#f3f4f6` | Dividers, skeleton loaders, secondary backgrounds |
| `gray-200` | `#e5e7eb` | Borders, input borders |
| `gray-400` | `#9ca3af` | Placeholder text, disabled states |
| `gray-500` | `#6b7280` | Secondary text, metadata (cook time, servings) |
| `gray-700` | `#374151` | Labels, secondary headings |
| `gray-900` | `#111827` | Primary text, headings |

### Neutrals (Dark Mode)

| Token | Hex | Usage |
|---|---|---|
| `gray-950` | `#030712` | App/page background |
| `gray-900` | `#111827` | Card backgrounds |
| `gray-800` | `#1f2937` | Secondary card backgrounds, input backgrounds |
| `gray-700` | `#374151` | Borders, dividers |
| `gray-500` | `#6b7280` | Placeholder text, disabled states |
| `gray-400` | `#9ca3af` | Secondary text, metadata |
| `gray-200` | `#e5e7eb` | Secondary headings |
| `white` | `#ffffff` | Primary text, headings |

The orange brand colour is used identically in both light and dark mode — it has sufficient contrast on both dark and light backgrounds at the values above.

### Semantic Colours

| Purpose | Light | Dark |
|---|---|---|
| Success | `#16a34a` (green-600) | `#22c55e` (green-500) |
| Error | `#dc2626` (red-600) | `#f87171` (red-400) |
| Warning | `#d97706` (amber-600) | `#fbbf24` (amber-400) |
| Info | `#2563eb` (blue-600) | `#60a5fa` (blue-400) |

---

## Typography

sousChef uses the system font stack. This gives native rendering quality on every platform, zero bundle overhead, and familiar legibility for users.

### Font Stack

**Web:**
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

**Mobile (React Native):**
React Native defaults to the system font automatically. No configuration required.

### Type Scale

| Name | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `display` | 32px / 2rem | 800 | 1.2 | App name, hero text |
| `heading-1` | 24px / 1.5rem | 700 | 1.3 | Page titles, recipe titles |
| `heading-2` | 20px / 1.25rem | 600 | 1.3 | Section headings |
| `heading-3` | 16px / 1rem | 600 | 1.4 | Card titles, subsection headings |
| `body` | 14px / 0.875rem | 400 | 1.6 | Body copy, descriptions |
| `body-sm` | 13px / 0.8125rem | 400 | 1.5 | Labels, secondary text, metadata |
| `caption` | 12px / 0.75rem | 400 | 1.4 | Timestamps, footnotes, helper text |
| `label` | 13px / 0.8125rem | 500 | 1.4 | Form labels, button text, tags |

### Rules

- Never go below 12px for any text.
- Body copy is always 400 weight. Reserve 500+ for labels, headings, and emphasis.
- Use `gray-900` / `white` for primary text. Use `gray-500` / `gray-400` for secondary text. Never use pure black (`#000000`).
- Avoid italic text in the UI — use weight contrast for emphasis instead.

---

## Spacing

sousChef uses a 4px base unit. All spacing values are multiples of 4.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Tight gaps between related inline elements |
| `space-2` | 8px | Internal component padding (small), icon gaps |
| `space-3` | 12px | Internal component padding (default) |
| `space-4` | 16px | Standard padding, gap between list items |
| `space-5` | 20px | Section padding (mobile) |
| `space-6` | 24px | Card padding, section gaps |
| `space-8` | 32px | Large section gaps |
| `space-10` | 40px | Page-level vertical rhythm |
| `space-12` | 48px | Between major page sections |

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 4px | Badges, tags, small chips |
| `radius-md` | 6px | Buttons, inputs, small cards |
| `radius-lg` | 12px | Cards, modals, bottom sheets |
| `radius-xl` | 16px | Large cards, image containers |
| `radius-full` | 9999px | Pill buttons, avatars |

---

## Elevation / Shadow

Shadows are used sparingly. Flat UI with subtle depth is preferred over heavy drop shadows.

| Level | CSS | Usage |
|---|---|---|
| 0 | none | Most surfaces — rely on background colour contrast |
| 1 | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` | Cards on a background, dropdowns |
| 2 | `0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)` | Modals, floating action buttons |
| 3 | `0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.05)` | Drawers, bottom sheets |

In dark mode, prefer borders (`gray-700`) over shadows for surface separation — shadows lose their effect on dark backgrounds.

---

## Components

### Buttons

**Primary** — for the main action on a screen. One per view.
- Background: `orange-500`, hover: `orange-600`
- Text: white, `label` size, weight 600
- Padding: `12px 20px`
- Radius: `radius-md`
- Disabled: 50% opacity

**Secondary** — for supporting actions.
- Background: transparent, border: `gray-200` (light) / `gray-700` (dark)
- Text: `gray-900` (light) / `white` (dark), `label` size, weight 500
- Same padding and radius as primary

**Destructive** — for delete/remove actions.
- Use the secondary style by default. Only switch to a red background on the final confirmation step.

**Ghost** — for low-priority actions, inline with content.
- No background, no border
- Text: `gray-500`, hover: `gray-900` (light) / `gray-400`, hover: `white` (dark)

**Icon buttons** — 36×36px tap target minimum. Icon at 20px.

### Inputs

- Border: `gray-200` (light) / `gray-700` (dark)
- Background: `white` (light) / `gray-800` (dark)
- Focus border: `orange-500`, with a subtle `orange-50` / `orange-500` at 10% opacity ring
- Radius: `radius-md`
- Padding: `10px 12px`
- Placeholder: `gray-400`
- Error state: red-600 border, error message below in `body-sm` / red

### Cards

Cards are the primary content container for recipes.

**Recipe card (list / collapsed view):**
- Shows: cover photo (16:9 or square crop), recipe title, cook time, one or two tags (cuisine type, dietary flags)
- Does not show: ingredient list, steps, macros, description
- Tap/click navigates to the detail view
- Background: `white` (light) / `gray-900` (dark)
- Shadow: level 1
- Radius: `radius-xl` on image, `radius-lg` on card

**Recipe detail view:**
- Progressive sections: hero image → title + metadata → ingredients → steps → notes/macros
- Sections are visually separated by whitespace, not heavy dividers
- Ingredients and steps are not visible until the user scrolls to them or taps a tab

### Tags / Badges

- Small pill with `radius-sm`
- Background: `orange-100` (light) / `orange-500` at 15% opacity (dark), text: `orange-600` / `orange-400`
- For neutral tags (cuisine type etc.): `gray-100` / `gray-800` background, `gray-700` / `gray-300` text
- Height: 24px, padding: `4px 8px`, font: `caption`, weight 500

### Navigation

**Web:** top navigation bar, minimal — logo left, primary nav items, account right. No mega-menus.

**Mobile:** bottom tab bar with 4–5 core destinations (Recipes, Meal Plan, Pantry, Shopping, Profile). Icons only, with label beneath the active tab.

---

## Iconography

Use a single icon library consistently. **Lucide** is the preferred choice — it's already available as a dependency (`lucide-react` on web, `lucide-react-native` on mobile), has a clean consistent stroke style, and covers all the domains sousChef needs (food, timers, shopping, etc.).

- Standard icon size: 20px
- In-text icon size: 16px
- Navigation icon size: 24px
- Stroke width: 1.5px (Lucide default)
- Colour: inherits from text colour unless used as a standalone action

---

## Images

- Recipe cover photos should always have a defined aspect ratio container so the layout doesn't shift while loading. Use 16:9 for list cards, 4:3 or full-width for detail hero.
- Always show a skeleton loader (animated `gray-100` / `gray-800` pulse) while images load.
- If no photo exists, show a neutral placeholder with a subtle fork/knife icon, not a broken image state.

---

## Dark Mode

Dark mode follows the system preference (`prefers-color-scheme` on web, `useColorScheme` on mobile). There is no manual toggle — respect what the user has set at OS level.

Key rules for dark mode:
- Never use pure black (`#000000`) as a background. Use `gray-950` (`#030712`).
- Cards sit one step lighter than the page background (`gray-900` on `gray-950`).
- Prefer border contrast over shadow for surface separation.
- Orange brand colour is unchanged.
- All semantic colours shift to their lighter variants (see Colour section).

---

## Motion

Animations should be functional, not decorative. If an animation doesn't help the user understand what just happened, remove it.

| Interaction | Duration | Easing |
|---|---|---|
| Button press | 100ms | ease-out |
| Modal / sheet open | 200ms | ease-out |
| Modal / sheet close | 150ms | ease-in |
| Page transition (mobile) | 250ms | ease-in-out |
| Skeleton to content | 150ms | ease-out |

Respect `prefers-reduced-motion` on web. On mobile, keep animations subtle — users on lower-end devices will thank you.

---

## Accessibility

- Minimum touch target: 44×44px on mobile (Apple HIG standard).
- Colour contrast: all text must meet WCAG AA (4.5:1 for body, 3:1 for large text). The orange-500 on white passes at large text sizes; use `gray-900` or white for body text on orange backgrounds.
- Interactive elements must have accessible labels (aria-label on web, accessibilityLabel on mobile).
- Never convey information through colour alone — pair colour with an icon or text label.

---

## Writing Style

- **Concise labels.** Prefer "Add recipe" over "Click here to add a new recipe".
- **Sentence case** for all UI labels, headings, and buttons. Not Title Case.
- **No exclamation marks** in UI copy. The product is calm and confident, not excitable.
- **Error messages** should say what happened and what to do: "Couldn't save recipe — check your connection and try again." Not just "Error."
- **Empty states** should be helpful and direct, not cutesy. "No recipes yet — add your first one." is fine.
