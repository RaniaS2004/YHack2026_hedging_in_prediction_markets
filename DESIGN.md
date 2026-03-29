# HedgeKit Design System

## Aesthetic
Clean, professional, data-forward. Light mode primary. Premium SaaS feel (Stripe/Linear inspiration). No template energy.

## Colors

### Backgrounds
- **Page**: `#FFFFFF`
- **Surface**: `#F8FAFC` (cards, table headers, stat boxes)
- **Border**: `#E2E8F0`
- **Border Hover**: `#CBD5E1`
- **Divider Light**: `#F1F5F9`

### Text
- **Primary**: `#0F172A` (headings, important content)
- **Secondary**: `#64748B` (body text, descriptions)
- **Muted**: `#94A3B8` (captions, labels, timestamps)

### Accent
- **Indigo**: `#6366F1` (primary actions, links, focus rings)
- **Indigo Hover**: `#4F46E5`
- **Indigo Muted**: `rgba(99, 102, 241, 0.08)` (selected states)

### Semantic
- **Green**: `#10B981` / text: `#059669` (profit, success, high confidence)
- **Red**: `#EF4444` / text: `#DC2626` (loss, error, danger)
- **Yellow**: `#F59E0B` / text: `#D97706` (warning, medium confidence)

### Platform Colors (at 8% opacity bg, full color text)
- Polymarket: `#A855F7` / `#7C3AED`
- Kalshi: `#3B82F6` / `#2563EB`
- Limitless: `#6366F1` / `#4F46E5`
- Myriad: `#F97316` / `#EA580C`
- Opinion: `#EC4899` / `#DB2777`

## Typography

### Font Stack
- **Headings**: `Satoshi` (via Fontshare CDN), fallback: `system-ui`
- **Body**: `DM Sans` (via next/font/google), fallback: `system-ui`
- **Mono/Numbers**: `Geist Mono` (via next/font/google), fallback: `SF Mono, Menlo`

### Scale
- **Display**: 36px / 700 / tracking -0.025em
- **H1**: 22px / 700 / tracking -0.02em
- **Body**: 15px / 400 / line-height relaxed
- **Body Small**: 13px / 400
- **Caption**: 11px / 500 / uppercase / tracking 0.05em
- **Mono Data**: 12px / font-mono / font-semibold

## Spacing
- **Card padding**: 16-20px
- **Section gap**: 24-32px
- **Component gap**: 12px
- **Page max-width**: 1120px (main), 640px (dashboard), 720px (execution)
- **Page padding**: 24px horizontal

## Border Radius
- **Cards/Buttons**: 12px (xl)
- **Badges/Inputs**: 8px (lg)
- **Small badges**: 6px (md)

## Components

### Nav
- 56px height, sticky, white/80 + backdrop-blur-sm, bottom border
- Indigo logo square (28px), semibold brand name

### Buttons
- Primary: indigo bg, white text, 12px radius, subtle indigo shadow
- Hover: darker indigo (#4F46E5)
- Disabled: 40% opacity

### Cards (HedgeCard)
- White bg, 1px border, 12px radius
- Selected: indigo border + indigo 3% bg tint
- Hover: border darkens, soft shadow appears

### Badges
- 8% opacity background, 20% opacity border, full-color text
- Confidence: green/yellow/red semantic
- Platform: brand color coded

### Data Display
- All numbers in font-mono
- P&L: green positive, red negative
- Pipe separators between inline stats
