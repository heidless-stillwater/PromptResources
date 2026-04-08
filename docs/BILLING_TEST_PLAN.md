# 🧪 Stillwater Billing Integration — Manual Validation Test Plan

> **Pre-requisites:**
> - All servers running: PromptResources (3002), PromptTool (3001), PromptMasterSPA (5173)
> - Stripe listener active: `/tmp/stripe listen --forward-to localhost:3002/api/webhooks/stripe`
> - Stripe test card: `4242 4242 4242 4242` | Any future date | Any CVV

---

## 🔐 Section 1 — Resource Privacy

**Goal:** Non-admin users should only see their own resources on the `/resources` page.

| # | Step | Expected Result |
|---|------|-----------------|
| 1.1 | Log in as **admin account** → visit `localhost:3002/resources` | All published resources visible |
| 1.2 | Log in as a **standard test account** → visit `localhost:3002/resources` | Only resources added by *that user* are shown |
| 1.3 | Log out completely → visit `localhost:3002/resources` | Redirected to landing page (`/`) |

---

## 🏠 Section 2 — Landing Page (Unauthenticated State)

**Goal:** Logged-out users see the public landing page, not the dashboard.

| # | Step | Expected Result |
|---|------|-----------------|
| 2.1 | Log out → visit `localhost:3002/` | Landing page shown (NOT redirected to `/dashboard`) |
| 2.2 | From landing page, click "Get Started" or "Sign In" | Redirected to `/auth/register` or `/auth/login` |

---

## 💎 Section 3 — Pricing Page & Checkout

**Goal:** Pricing link is accessible from navbar, and checkout works correctly.

| # | Step | Expected Result |
|---|------|-----------------|
| 3.1 | Visit `localhost:3002` → look at the navbar | "💎 Pricing" link is visible |
| 3.2 | Click "💎 Pricing" | Navigates to `localhost:3002/pricing` |
| 3.3 | Click "Get Started Now" while **logged out** | Triggers Google sign-in popup |
| 3.4 | Click "Get Started Now" while **logged in** | Opens Stripe Checkout page (no 500 error) |
| 3.5 | Confirm Stripe checkout page | Shows real product name and price (not `$XX.XX`) |

---

## ↩️ Section 4 — Checkout ReturnUrl (Cross-App Routing)

**Goal:** After checkout, user is redirected back to the app they came from.

| # | Step | Expected Result |
|---|------|-----------------|
| 4.1 | Visit `localhost:5173` → hit Registry gate → click "Upgrade to Pro Suite" | Opens `localhost:3002/pricing?returnUrl=http://localhost:5173` |
| 4.2 | Complete checkout with test card | Redirected back to `localhost:5173?subscribed=true` ✅ |
| 4.3 | Visit `localhost:3001/generate` → hit Studio gate → click "Upgrade to Master Suite" | Opens `localhost:3002/pricing?returnUrl=http://localhost:3001/generate` |
| 4.4 | Complete checkout with test card | Redirected back to `localhost:3001/generate?subscribed=true` ✅ |
| 4.5 | Visit `localhost:3002/pricing` directly → checkout | Redirected to `localhost:3002/dashboard?subscribed=true` ✅ |

---

## ⚡ Section 5 — Real-Time Subscription Update

**Goal:** Dashboard auto-updates after Stripe webhook fires — no page refresh needed.

| # | Step | Expected Result |
|---|------|-----------------|
| 5.1 | Open `localhost:3002/dashboard` as **unsubscribed** account | Shows "💎 Free Plan" card with "Upgrade →" button |
| 5.2 | Complete a Stripe test checkout → return to the already-open dashboard tab | "Free Plan" card **auto-updates** to bundle name + ✅ ACTIVE badge with NO manual refresh |
| 5.3 | Check Stripe listener terminal | Shows: `✅ User [uid] granted access to: resources, studio, prompttool, registry` |

---

## 📋 Section 6 — Dashboard Suite Card (App Listing)

**Goal:** Dashboard shows each app in the suite with correct locked/unlocked status.

| # | Step | Expected Result |
|---|------|-----------------|
| 6.1 | Visit `localhost:3002/dashboard` as **subscribed user** | Suite card shows 3 app tiles: 📚 PromptResources, 🎨 PromptTool Studio, 📋 PromptMaster Registry |
| 6.2 | Each app included in `activeSuites` | Shows "✓ Unlocked" in green |
| 6.3 | Click an unlocked app tile | Opens that app in a new tab |
| 6.4 | Visit as **free user** | Shows compact "Free Plan" upgrade prompt instead |

---

## ⚙️ Section 7 — Settings Page Subscription Display

**Goal:** Settings page reflects the live subscription accurately.

| # | Step | Expected Result |
|---|------|-----------------|
| 7.1 | Visit `localhost:3002/dashboard/settings` as **subscribed** user | "💎 Subscription" card shows bundle name, ✅ ACTIVE badge, and coloured suite pills |
| 7.2 | Suite pills shown | Should include all suites e.g. `📚 resources`, `🎨 studio`, `📋 registry`, `✨ prompttool` |
| 7.3 | Click "Manage Plan" | Navigates to `/pricing` |
| 7.4 | Visit settings as a **free user** | Shows "FREE" badge + "Upgrade Plan" button linking to `/pricing` |

---

## 🎨 Section 8 — PromptTool Studio Gate

**Goal:** PromptTool correctly unlocks for subscribed users with `studio` OR `prompttool` suite key.

| # | Step | Expected Result |
|---|------|-----------------|
| 8.1 | Visit `localhost:3001/generate` as **unsubscribed** user | "Studio Access Restricted" overlay shown |
| 8.2 | Visit as **subscribed** user (with `studio` OR `prompttool` in suites) | Overlay gone — Studio fully accessible |
| 8.3 | Attempt to call `/api/generate` directly as **unsubscribed** (via DevTools fetch) | Returns `403 Forbidden` |

---

## 📋 Section 9 — PromptMaster Registry Gate

**Goal:** PromptMasterSPA unlocks for subscribed users with `registry` suite key.

| # | Step | Expected Result |
|---|------|-----------------|
| 9.1 | Visit `localhost:5173` as **unsubscribed** user | "Registry Access Restricted" overlay shown |
| 9.2 | Visit as **subscribed** user (with `registry` in suites) | Overlay gone — Registry fully accessible |

---

## ✅ Overall Pass Criteria

All test cases above must pass. Key indicators of full system health:

- [ ] No 500 errors in checkout flow
- [ ] Stripe webhook terminal shows successful user grant message
- [ ] Dashboard auto-updates without page refresh after checkout
- [ ] Each app gate correctly responds to entitlement state
- [ ] Cross-app `returnUrl` routing works for all three originating apps
- [ ] `studio` and `prompttool` are treated as equivalent keys for PromptTool access
