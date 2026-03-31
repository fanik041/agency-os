# Meta/Instagram-Inspired UI Theme — Design Spec

**Date:** 2026-03-30
**Status:** Approved
**Goal:** Apply Meta/Instagram design language (colors, borders, badges, backgrounds) across the dashboard. CSS/styling only — no data, content, or structural changes.

---

## Constraint

- Zero changes to HTML structure, table columns, data fields, or business logic
- Only modify: CSS variables, Tailwind classes, component styling
- All existing functionality must remain identical

## Color Palette

### Backgrounds
- Page background: `#f0f2f5` (Meta gray) — replaces pure white
- Card/surface: `#ffffff` on gray background — creates depth
- Sidebar: `#ffffff` with right border `#dadde1`

### Text
- Primary text: `#1c1e21` (near-black)
- Secondary text: `#65676b` (Meta gray)
- Muted/tertiary: `#8a8d91`

### Primary (Facebook Blue)
- Primary: `#1877f2`
- Primary hover: `#1264c8`
- Primary light bg: `#e7f3ff`

### Status Colors (pill badges)
- New: `#e7f3ff` bg / `#1877f2` text
- Scoring: `#fff3cd` bg / `#856404` text
- Needs Review: `#fff3cd` bg / `#d97706` text
- Approved: `#d4edda` bg / `#16a34a` text
- Sent: `#e7f3ff` bg / `#1877f2` text
- Replied: `#d4edda` bg / `#16a34a` text
- Booked: `#cce5ff` bg / `#004085` text
- Closed: `#f0f2f5` bg / `#65676b` text
- Skip: `#f0f2f5` bg / `#8a8d91` text

### Borders
- Card border: `#dadde1`
- Table row border: `#e4e6eb`
- Input border: `#ced0d4`

## Changes by File

### 1. `globals.css`
Update CSS variables to Meta palette:
- `--background`: `#f0f2f5` (gray page bg)
- `--card`/`--popover`: `#ffffff` (white surfaces)
- `--primary`: `#1877f2` (Facebook blue)
- `--primary-foreground`: `#ffffff`
- `--border`: `#dadde1`
- `--muted`: `#f0f2f5`
- `--muted-foreground`: `#65676b`
- `--accent`: `#e7f3ff`
- `--accent-foreground`: `#1877f2`
- Sidebar: white bg, `#1877f2` active/ring

### 2. `lib/constants.ts` — STATUS_COLORS
Update badge color classes to pill-style with tinted backgrounds:
- Use `bg-[color]/15 text-[color]` pattern for each status
- Add `rounded-full px-2.5` for pill shape

### 3. `sidebar.tsx`
- White background instead of gray
- Active nav item: light blue bg (`#e7f3ff`) with blue text
- Subtle right border on desktop sidebar

### 4. `layout.tsx`
- Main content area gets `bg-[#f0f2f5]` background

### 5. Card components across pages
- Add subtle shadow: `shadow-[0_1px_2px_rgba(0,0,0,0.1)]`
- Border: `border-[#dadde1]`
- Already have `rounded-lg` from shadcn

### 6. Button styling
- Primary buttons: solid `#1877f2` bg
- Outline/secondary buttons: `#e7f3ff` bg with `#1877f2` text (Meta secondary style)

### 7. Table styling
- Table header row: `bg-[#f0f2f5]` background
- Row borders: `border-[#e4e6eb]`
- Hover: `hover:bg-[#f7f8fa]`

### 8. Search input
- Rounded pill shape: `rounded-full`
- Gray background: `bg-[#f0f2f5]`
