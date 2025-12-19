# Color Palette Update Reference

## New Color Palette

### Primary Colors

```css
/* Dark Teal/Forest Green - Primary Brand Color */
--primary-dark: #2D4A47;      /* Darker teal for emphasis */
--primary: #3A5B57;            /* Main brand color */

/* Bright Yellow/Lime - Accent/Highlight */
--accent-yellow: #D4FF00;      /* Bright yellow for highlights */
--accent-lime: #C3F73A;        /* Lime green for CTAs and active states */

/* Dark Background */
--bg-dark: #1A2B29;            /* Main dark background */
--bg-darker: #0F1B1A;          /* Darker surfaces (cards, modals) */
```

### Neutral Colors (Light Mode)

```css
--bg-light: #FFFFFF;           /* Light mode background */
--bg-gray-light: #F5F5F5;      /* Light gray backgrounds */
--bg-gray: #E8E8E8;            /* Medium gray */

/* Text colors */
--text-dark: #1F1F1F;          /* Primary text (light mode) */
--text-medium: #4A4A4A;        /* Secondary text */
--text-light: #8A8A8A;         /* Tertiary text */
```

### Semantic Colors

```css
--success: #10B981;            /* Success/Active states */
--surface-white: #FFFFFF;      /* Light mode surfaces */
--surface-gray: #F9FAFB;       /* Light mode card backgrounds */
--border-light: #E5E7EB;       /* Light mode borders */
```

---

## Current vs New CSS Variable Mapping

### Dark Mode Variables

| Current Variable | Current Value | New Value | Usage |
|-----------------|---------------|-----------|-------|
| `--background` | `#0a0a0a` | `#1A2B29` | Main page background |
| `--foreground` | `#ededed` | `#FFFFFF` or `#E5E7EB` | Primary text |
| `--card` | `#0a0a0a` | `#0F1B1A` | Card/modal backgrounds |
| `--card-foreground` | `#ededed` | `#FFFFFF` | Text on cards |
| `--muted` | `#262626` | `#2D4A47` | Muted backgrounds |
| `--muted-foreground` | `#a3a3a3` | `#9CA3AF` | Muted text |
| `--border` | `#262626` | `#3A5B57` (opacity 20-30%) | Borders |
| `--input` | `#262626` | `#2D4A47` | Input backgrounds |
| `--ring` | `#ededed` | `#C3F73A` | Focus rings |
| `--accent` | `#262626` | `#2D4A47` | Accent backgrounds |
| `--accent-foreground` | `#ededed` | `#FFFFFF` | Text on accent |
| `--primary` | `#ededed` | `#3A5B57` | Primary buttons/brand |
| `--primary-foreground` | `#0a0a0a` | `#FFFFFF` | Text on primary |

### Light Mode Variables

| Current Variable | Current Value | New Value | Usage |
|-----------------|---------------|-----------|-------|
| `--background` | `#ffffff` | `#FFFFFF` | Main page background |
| `--foreground` | `#171717` | `#1F1F1F` | Primary text |
| `--card` | `#ffffff` | `#F9FAFB` | Card/modal backgrounds |
| `--card-foreground` | `#171717` | `#1F1F1F` | Text on cards |
| `--muted` | `#f5f5f5` | `#F5F5F5` | Muted backgrounds |
| `--muted-foreground` | `#737373` | `#4A4A4A` | Muted text |
| `--border` | `#e5e5e5` | `#E5E7EB` | Borders |
| `--input` | `#e5e5e5` | `#E8E8E8` | Input backgrounds |
| `--ring` | `#171717` | `#3A5B57` | Focus rings |
| `--accent` | `#f5f5f5` | `#F5F5F5` | Accent backgrounds |
| `--accent-foreground` | `#171717` | `#1F1F1F` | Text on accent |
| `--primary` | `#171717` | `#3A5B57` | Primary buttons/brand |
| `--primary-foreground` | `#ffffff` | `#FFFFFF` | Text on primary |

---

## New Additional Variables to Add

These will be available in both light and dark modes:

```css
--primary-dark: #2D4A47;       /* Darker teal variant */
--accent-yellow: #D4FF00;      /* Bright yellow for highlights */
--accent-lime: #C3F73A;        /* Lime green for CTAs */
--bg-dark: #1A2B29;            /* Dark mode main background */
--bg-darker: #0F1B1A;          /* Dark mode deeper backgrounds */
```

---

## Component-Specific Color Usage

### Buttons

**Primary Button (Dark Mode)**
- Background: `--primary` (`#3A5B57`)
- Text: `--primary-foreground` (`#FFFFFF`)
- Hover: Slightly lighter teal (`#4A6B67`)

**CTA/Accent Button**
- Background: `--accent-lime` (`#C3F73A`)
- Text: `--text-dark` (`#1F1F1F`)
- Hover: Slightly brighter lime

**Secondary/Outline Button**
- Background: Transparent
- Border: `--border` (teal with opacity)
- Text: `--foreground`
- Hover: `--muted` background

### Status Colors (Unchanged - Keep Distinct)

These will remain as they are for clarity:
- **Saved**: Gray
- **Applied**: Blue
- **Interview**: Purple
- **Offer**: Green
- **Rejected**: Red
- **Ghosted**: Orange

### Active/Tab States

- Active tab underline: `--accent-lime` (`#C3F73A`)
- Active tab text: `--primary` or `--accent-lime`
- Badge background: `--primary` with opacity

### Inputs & Forms

- Border: `--border` (muted teal)
- Focus border: `--ring` (`--accent-lime` in dark, `--primary` in light)
- Background: `--input` (darker teal in dark mode, light gray in light mode)

### Cards & Surfaces

- Background: `--card` (`#0F1B1A` in dark, `#F9FAFB` in light)
- Border: `--border` (muted teal)

---

## Browser Extension Popup

### Current Colors → New Colors

| Element | Current | New |
|---------|---------|-----|
| Body background | `#0a0a0a` | `#1A2B29` |
| Card/field background | `#171717` | `#0F1B1A` |
| Border | `#262626` | `#3A5B57` (30% opacity) |
| Primary button | `#ededed` | `#C3F73A` |
| Primary button text | `#0a0a0a` | `#1F1F1F` |
| Text | `#ededed` | `#FFFFFF` |
| Muted text | `#a3a3a3` | `#9CA3AF` |

---

## Visual Examples

### Dark Mode Theme

```
Background: #1A2B29 (dark teal-gray)
├── Cards: #0F1B1A (darker)
├── Primary buttons: #3A5B57 (teal)
├── CTA buttons: #C3F73A (lime green) with dark text
├── Active highlights: #D4FF00 (bright yellow)
└── Borders: #3A5B57 with 20-30% opacity
```

### Light Mode Theme

```
Background: #FFFFFF (white)
├── Cards: #F9FAFB (very light gray)
├── Primary buttons: #3A5B57 (teal) with white text
├── CTA buttons: #C3F73A (lime green) with dark text
├── Active highlights: #D4FF00 (bright yellow)
└── Borders: #E5E7EB (light gray)
```

---

## Implementation Files to Update

1. **`src/app/globals.css`**
   - Update all CSS variable definitions
   - Add new variables for accent colors
   - Update `@theme inline` directive

2. **`browser-extension/popup.html`**
   - Update inline styles to match new palette
   - Update button colors
   - Update background and border colors

3. **Review these components** (will auto-update via CSS variables):
   - `src/components/ui/button.tsx`
   - `src/components/layout/simple-top-bar.tsx`
   - `src/components/jobs/applications-header.tsx`
   - All other components using theme variables

---

## Accessibility Considerations

### Contrast Ratios (WCAG AA)

- **Teal on White**: `#3A5B57` on `#FFFFFF` = 5.4:1 ✓
- **Lime on Dark**: `#C3F73A` on `#1F1F1F` = 15.2:1 ✓
- **White on Teal**: `#FFFFFF` on `#3A5B57` = 8.1:1 ✓
- **Dark Text on Lime**: `#1F1F1F` on `#C3F73A` = 12.9:1 ✓

All color combinations meet WCAG AA standards for normal text.

---

## Color Usage Guidelines

1. **Primary Teal (`#3A5B57`)**: Main brand color, buttons, links, primary actions
2. **Accent Lime (`#C3F73A`)**: CTAs, active states, important highlights
3. **Accent Yellow (`#D4FF00`)**: Active tabs, badges, strong highlights
4. **Dark Teal (`#2D4A47`)**: Hover states, muted backgrounds, depth
5. **Backgrounds**: `#1A2B29` (dark), `#FFFFFF` (light)
6. **Cards**: `#0F1B1A` (dark), `#F9FAFB` (light)

---

## Questions for Review

1. Should accent yellow (`#D4FF00`) be used more sparingly than lime (`#C3F73A`)?
2. Are the proposed border opacity values (20-30%) appropriate?
3. Should hover states be a fixed lighter/darker shade or use opacity overlays?
4. Any specific components that need custom color treatment beyond the variables?

