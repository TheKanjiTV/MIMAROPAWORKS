# DESIGN — Design System & Output Conventions

> **Purpose:** Define visual/brand identity, design tokens, component styling, layout primitives, and accessibility conventions so UI implementation is consistent and high-quality. Tier-3 template — fill it in for your project.

> [!TIP]
> **Don't want to build from scratch?** You can find 74 ready-to-use brand presets in the `examples/brand-presets/` directory. Copy one of them into your project to instantly adopt its visual language.

_Last updated: September 12, 2026_

---

## 1. Brand Identity & Art Direction

MIMAWorks AI presents a professional, trustworthy, and approachable visual identity that reflects its mission to connect job seekers with employment opportunities in the MIMAROPA region.

- **Brand Voice:** Professional, helpful, inclusive, and optimistic
- **Visual Aesthetic:** Clean and modern with a focus on usability, featuring a balanced color scheme that conveys trust and growth
- **Design Philosophy:** User-centered design with clear information hierarchy, intuitive interactions, and accessible components that serve diverse users including those with varying technical proficiency

---

## 2. Color Palette & Semantic Tokens

The color palette combines professional blues with growth-oriented greens and trustworthy grays, creating a visual language that feels both reliable and forward-looking.

- **Primary Accent:** `var(--color-primary)` (`#2563EB` / HSL 216, 80%, 55%) - Represents trust, stability, and professionalism
- **Secondary Accent:** `var(--color-secondary)` (`#10B981` / HSL 163, 72%, 45%) - Represents growth, opportunity, and positive outcomes
- **Backgrounds & Surfaces:**
  - Background Base: `var(--bg-base)` (`#FFFFFF` / pure white for light mode)
  - Surface Elevation 1 (Cards, Modals): `var(--bg-surface-1)` (`#F8FAFC` / very light gray)
  - Surface Elevation 2 (Dropdowns, Tooltips): `var(--bg-surface-2)` (`#F1F5F9` / light gray)
- **Semantic State Tokens:**
  - Success: `var(--color-success)` (`#10B981` / HSL 163, 72%, 45%) - Used for successful matches, confirmed applications
  - Warning: `var(--color-warning)` (`#F59E0B` / HSL 46, 83%, 53%) - Used for incomplete profiles, pending verifications
  - Danger / Error: `var(--color-error)` (`#EF4444` / HSL 355, 82%, 53%) - Used for validation errors, failed operations
  - Info: `var(--color-info)` (`#3B82F6` / HSL 216, 79%, 53%) - Used for informational tips, guidance

---

## 3. Theme Variants (Light / Dark / Custom)

The system supports both light and dark themes to accommodate user preferences and different lighting conditions, with automatic switching based on system preferences.

- **Light Theme Tokens:** Default palette as defined above, optimized for daytime use
- **Dark Theme Tokens:** 
  - Background Base: `var(--bg-base)` (`#0F172A` / very dark blue)
  - Surface Elevation 1: `var(--bg-surface-1)` (`#1E293B` / dark slate)
  - Surface Elevation 2: `var(--bg-surface-2)` (`#334155` / medium dark slate)
  - Primary Accent: `var(--color-primary)` (`#60A5FA` / lighter blue for dark mode contrast)
  - Secondary Accent: `var(--color-secondary)` (`#34D399` / lighter green for dark mode contrast)
- **Theme Switching:** Managed via CSS class (`[data-theme="dark"]`) on the HTML element, with automatic detection of `prefers-color-scheme` media query and user preference persistence in localStorage

---

## 4. Typography Scale & Font Stack

Typography is chosen for optimal readability across devices and accessibility standards, with a focus on clear hierarchy and legibility.

- **Font Family (Body & UI):** `Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif` - Chosen for excellent readability on screens and comprehensive language support
- **Font Family (Monospace / Code):** `Fira Code, JetBrains Mono, monospace` - For displaying technical information or code snippets
- **Type Scale:**
  - `Display / H1`: 36px / 2.25rem (Bold 700, line-height 1.2) - Main page titles
  - `H2`: 28px / 1.75rem (SemiBold 600, line-height 1.3) - Section headers
  - `H3`: 22px / 1.375rem (SemiBold 600, line-height 1.35) - Subsection headers
  - `H4`: 18px / 1.125rem (Medium 500, line-height 1.4) - Card titles, form section headers
  - `Body Base`: 16px / 1rem (Regular 400, line-height 1.5) - Primary text content
  - `Body Small / Caption`: 14px / 0.875rem (Regular 400, line-height 1.4) - Helper text, metadata
  - `Text XS`: 12px / 0.75rem (Regular 400, line-height 1.3) - Captions, footnotes

---

## 5. Spacing, Grid & Layout System

A consistent spacing system based on an 8px grid ensures visual harmony and responsive behavior across different screen sizes.

- **Spacing Scale (8pt Base):** `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `40px`, `48px`, `56px`, `64px`
- **Grid Breakpoints:**
  - Mobile (`sm`): 640px - Single column layout
  - Tablet (`md`): 768px - Two-column layouts begin
  - Desktop (`lg`): 1024px - Full sidebar navigation visible
  - Large Desktop (`xl`): 1280px - Maximum content width reached
- **Layout Containers:** `max-width: 1200px` with responsive horizontal padding (`px-4` on mobile, `px-6` on tablet, `px-8` on desktop)
- **Content Areas:** 
  - Narrow columns (forms, profiles): 480px maximum width for optimal readability
  - Wide content (dashboards, tables): Utilize full container width with appropriate padding
  - Dashboards: Flexible grid system that adapts from 1 column (mobile) to 4 columns (large desktop)

---

## 6. Border Radius, Elevation & Borders

Consistent border treatment creates a cohesive visual language with appropriate visual hierarchy.

- **Border Radius Tokens:** 
  - `radius-none` (0px) - For tables, full-width elements
  - `radius-sm` (4px) - For inputs, buttons, tags
  - `radius-md` (8px) - For cards, modals, dropdowns
  - `radius-lg` (12px) - For modals, large containers
  - `radius-xl` (16px) - For special containers, hero sections
  - `radius-full` (9999px) - For avatars, circular buttons
- **Borders & Dividers:** 
  - Default: `1px solid var(--border-color)` where `--border-color` is `#E2E8F0` (light mode) / `#334155` (dark mode)
  - Strong: `2px solid var(--border-color)` for emphasized sections
  - Dashed: `2px dashed var(--border-color)` for drop zones, placeholder areas

---

## 7. Shadows, Motion & Animations

Subtle elevation and thoughtful motion enhance usability without distraction.

- **Shadow Tokens:**
  - `shadow-sm`: `0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.05)` - For buttons, inputs
  - `shadow-md`: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)` - For cards, modals
  - `shadow-lg`: `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)` - For dropdowns, elevated containers
  - `shadow-xl`: `0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -3px rgba(0, 0, 0, 0.04)` - For modals, flyouts
- **Transition Speed:** 
  - Fast (100ms) - For button states, input focus
  - Medium (200ms) - For card hover, modal entrance
  - Slow (300ms) - For page transitions, sidebar animations
  - All transitions use `cubic-bezier(0.4, 0, 0.2, 1)` easing for natural motion
- **Reduced Motion:** Respect `@media (prefers-reduced-motion: reduce)` by:
  - Disabling non-essential animations
  - Reducing transition durations to 50ms
  - Replacing motion-based feedback with opacity or scale changes

---

## 8. Accessibility Guidelines

Accessibility is a core principle ensuring the platform can be used by everyone, including people with disabilities.

- **Conformance Target:** WCAG 2.2 AA
- **Contrast Minimums:** 
  - 4.5:1 for normal text
  - 3:1 for large text (18pt+ bold or 24pt+ regular) and UI components
  - Enhanced contrast mode available for users needing higher contrast ratios
- **Keyboard Navigation:** 
  - Explicit, visible focus rings on all interactive elements (2px solid `var(--color-primary)`)
  - Logical tab order following visual flow
  - Skip navigation links for screen reader users
  - Customizable keyboard shortcuts for power users
- **Screen Reader Support:** 
  - Semantic HTML markup (header, nav, main, section, article, button, etc.)
  - ARIA labels and descriptions where semantic elements aren't sufficient
  - Live regions for dynamic content updates (toast notifications, loading states)
  - Proper labeling of form fields, including required indicators
- **Additional Considerations:**
  - Text resizing support up to 200% without loss of functionality
  - Color-blind friendly palettes with redundant coding (icons + color)
  - Touch target minimum size of 44x44dp
  - Form validation that announces errors inline and in screen readers

---

## 9. Component Style Rules

Consistent component states ensure predictable user interactions.

- **Buttons:** 
  - Primary: Solid background with `var(--color-primary)`, white text
  - Secondary: Transparent background with `var(--color-primary)` text and border
  - Outline: Transparent background with `var(--color-primary)` border, `var(--color-primary)` text
  - Danger: Solid background with `var(--color-error)`, white text
  - All variants include: hover (10% brightness change), focus (outline-ring), disabled (50% opacity, cursor-not-allowed), active (20% brightness change)
- **Form Inputs:** 
  - Consistent label placement (above input for forms, inline for filters)
  - Helper text below input for guidance
  - Error states: red border (`var(--color-error)`) with icon and message below
  - Success states: green border (`var(--color-success)`) with checkmark icon
  - Focus ring: 2px solid `var(--color-primary)` with 2px offset
  - Disabled state: 50% opacity, cursor-not-allowed
- **Modals & Cards:** 
  - Modals: Backdrop blur (`blur(4px)` on light mode, `blur(8px)` on dark mode), overlay click to close, escape key to close, focus trapping
  - Cards: Uniform elevation (`shadow-md`), hover lift (`shadow-lg`), clickable cards have pointer cursor and subtle scale transform on hover
  - Dialogs: Width constraints (max 500px on mobile, 600px on desktop), responsive padding

---

## 10. Product Tour & Interaction Patterns

Established UX patterns reduce cognitive load and improve task completion rates.

- **Toast Notifications:** 
  - Position: Bottom-center on mobile, top-right on desktop
  - Duration: 4 seconds for success/info, 8 seconds for warnings (dismissible on hover)
  - Appearance: Slide-in from edge, appropriate color coding, progress bar indicator
  - Actions: Primary action button for relevant follow-ups (e.g., "View Profile" on application success)
- **Onboarding / Product Tour:** 
  - Step-by-step modal tooltips highlighting key features
  - Skippable with persistent "Show tour again" option in help menu
  - Progress indicator showing current step/total steps
  - Focus on value proposition: "Get your first job match in 30 seconds"
- **Empty States:** 
  - Illustrative graphics with clear guidance
  - Primary action button to populate the empty state (e.g., "Add your first skill")
  - Secondary text with helpful tips or learning resources
- **Data Tables:** 
  - Sortable columns with visual indicators
  - Pagination or infinite scroll based on data volume
  - Row selection with bulk actions
  - Responsive design that converts to cards on mobile
  - Export functionality (CSV, PDF)

---

## 11. Output Conventions (Non-UI Projects)

For APIs, background services, and data exports, consistent output formats ensure reliable integration.

- **API Response Format:**
  - Success: `{ "success": true, "data": {...}, "meta": {...} }`
  - Error: `{ "success": false, "error": { "code": "ERROR_CODE", "message": "User-friendly message", "details": {...} } }`
  - Pagination: `{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 100, "pages": 5 } }`
- **Date/Time Format:** ISO 8601 UTC strings (e.g., "2026-09-12T14:30:00Z") with optional localized formatting in UI
- **Numeric Precision:** 
  - Percentages: 1 decimal place (e.g., 85.3%)
  - Currency: 2 decimal places with appropriate symbol (PHP)
  - Scores: 1-2 decimal places depending on context (match scores: 2 decimals)
- **Logging Format:** Structured JSON with timestamp, level, service, message, and optional context fields
- **Exit Codes (CLI/Scripts):**
  - 0: Success
  - 1: General error
  - 2: Invalid input/arguments
  - 3: Permission/access denied
  - 4: Resource not found
  - 5: Timeout
  - 6: Configuration error
  - 7-255: Application-specific errors (documented in code)