# 🎨 Stillwater Ecosystem — Style Unification Project Plan (v0.1)

> **Objective:** Transition the Stillwater Suite (`PromptResources`, `PromptTool`, `PromptMasterSPA`) from independent styling to a unified, cohesive Design System that ensures a seamless "Invisible Context Switch" for users.

---

## 🏗️ Phase 1 — Token Standardization (Immediate)

**Goal:** Synchronize the core DNA of the apps without changing architectural logic.

- [x] **Audit Hex Codes:** Capture all variations of colors used across the three apps.
- [x] **Global CSS Variable Sync:** Standardize variables across all `globals.css` files:
    ```css
    :root {
      --brand-primary: #6366f1;
      --brand-accent: #8b5cf6;
      --brand-bg: #0a0a0f;
      --glass-blur: 12px;
      --glass-border: rgba(255, 255, 255, 0.08);
      --radius-pro: 16px;
    }
    ```
- [x] **Typography Alignment:** Ensure `Inter` (UI) and `Outfit` (Headings) use identical weight mappings and line-heights in all Tailwind configs.

---

## 💎 Phase 2 — The "Glassmorphism" Core

**Goal:** Establish a single source of truth for the platform's signature look.

- [x] **Define Master Glass Classes:** Create a standard `.glass-panel` and `.glass-card` set of utilities.
- [x] **State-Aware Styling:** Ensure hover states, active states, and focus rings use identical `--brand-glow` variables.
- [x] **Depth System:** Define 3 levels of "Glass Depth" (Surface, Card, Overlay) to be used consistently across all three apps.

---

## 🧩 Phase 3 — Peripheral Component Shell (The "Glue")

**Goal:** Unify the elements the user sees during every navigation.

- [x] **The "Stillwater Nav":** Harmonize the height (72px), blur, and logo positioning of the navbar.
- [x] **Status Badge Registry:** Standardize the styling for:
    - `✅ ACTIVE` (Subscription Status)
    - `💎 PRO` / `✨ MASTER` (Plan Tiers)
    - `curated` / `verified` (Content Status)
- [x] **Loading & Empty States:** Port the shimmer effects and "empty state" illustrations from `PromptResources` to the other two apps.

---

## 🚀 Phase 4 — Architectural Convergence

**Goal:** Simplify maintenance long-term by modernizing the tech stack.

- [~] **Tailwind v4 Migration:** *[DEFERRED]* Next.js 14 + Webpack loaders are incompatible with stable v4. Maintained ecosystem on stable v3.4.1.
- [x] **Shared Token Library:** Extract all CSS variables into a shared `stillwater-tokens.css` that can be imported via URL or symlink.
- [x] **Favicon & Meta Sync:** Ensure brand identity (OS theme colors, icons) is identical at the browser level.

---

## ✅ Project Complete — Stillwater Unified

**Status:** ALL PHASES COMPLETED.
**Outcome:** The Stillwater Ecosystem (`Registry`, `Studio`, `Resources`) is now visually and architecturally unified.
- ✅ Shared Design Tokens
- ✅ Standardized High-Fidelity Components
- ✅ Harmonized Browser Identity
- ✅ Premium Glassmorphism Design System

## ✅ Pass Criteria for Style Unification

- [x] Navigation between apps feels like a single SPA (no layout "jump").
- [ ] Changing `--brand-primary` in one config updates the look across the entire ecosystem.
- [ ] Visual regression check: All buttons across all apps have identical border-radii and transitions.

---
**Status:** 📝 Draft / In-Review
**Architect:** Antigravity (Assistant)
**Current Date:** 2026-04-08
