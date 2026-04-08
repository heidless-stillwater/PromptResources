# STRIPE_TEST_0 — SaaS Unified Billing & Suite Gating Validation Plan

This document outlines the manual verification steps required to ensure the stability and accuracy of the **Ecosystem Unified Billing System** and the **cross-app suite entilement gates**.

## 🏁 Prerequisites
- The Stripe CLI must be running locally to forward webhooks to your local API.
  - Run: `stripe listen --forward-to localhost:3002/api/webhooks/stripe`
- All three apps running simultaneously:
  - Subject A: PromptResources (Billing Hub - Port 3002)
  - Subject B: PromptTool (Studio - Port 3001)
  - Subject C: PromptMasterSPA (Registry - Port 5173)
- Ensure you have a standard test user account logged into all three apps simultaneously.

---

## 🧪 Test Scenarios

### 1. Studio Access Gate (Unauthenticated/Unauthorized)
**Goal**: Verify that non-subscribers cannot access the Studio Engine.

- [ ] Navigate to `/generate` in **PromptTool** (Port 3001).
- [ ] Confirm you see the "Studio Access Restricted" glassmorphism overlay.
- [ ] Click **"Upgrade to Master Suite"**.
- [ ] Verify you are correctly redirected to the Pricing page on PromptResources (Port 3002).

### 2. Registry Access Gate (Unauthenticated/Unauthorized)
**Goal**: Verify that non-subscribers cannot access the Registry framework.

- [ ] Navigate to the main dashboard in **PromptMasterSPA** (Port 5173).
- [ ] Confirm you see the "Registry Access Restricted" premium overlay.
- [ ] Click **"Upgrade to Pro Suite"**.
- [ ] Verify you are correctly redirected to the Pricing page on PromptResources (Port 3002).

### 3. Stripe Checkout & Active Subscription Simulation
**Goal**: Verify the end-to-end checkout flow and Webhook fulfillment sync.

- [ ] Navigate to the Pricing page (`/pricing`) in **PromptResources** (Port 3002).
- [ ] Click to subscribe to the "Master Suite" / "Pro Suite" (which should trigger your local Stripe Checkout session).
- [ ] In the Stripe test checkout, complete the payment using a test card (e.g., `4242 4242 ...`).
- [ ] Wait for the success redirect.
- [ ] Check your local console or Stripe CLI to ensure the `checkout.session.completed` (or `customer.subscription.updated`) webhook was received with 200 OK.
- [ ] Verify the user's document in Firestore (`users/{uid}`) in the default database now contains:
  - `subscriptionMetadata.activeSuites` includes `['studio', 'registry']`.
  - `subscriptionMetadata.status` is `'active'`.

### 4. Entitlement Fulfillment Validation (Studio)
**Goal**: Verify PromptTool immediately recognizes the new subscription.

- [ ] Return to **PromptTool** (Port 3001) and navigate to `/generate`.
- [ ] Confirm the "Studio Access Restricted" overlay is GONE.
- [ ] Verify you have full access to the prompt UI, settings, and generated image viewer.
- [ ] Perform a simple test generation to verify the backend API check also passes successfully.

### 5. Entitlement Fulfillment Validation (Registry)
**Goal**: Verify PromptMasterSPA immediately recognizes the new subscription.

- [ ] Return to **PromptMasterSPA** (Port 5173) and refresh the page.
- [ ] Confirm the "Registry Access Restricted" overlay is GONE.
- [ ] Verify you have full access to the active Blueprint lists and dashboard tools.
- [ ] Attempt to save or edit a blueprint to ensure the Firestore Security Rules allow the write.

---

## 🚩 Reporting Issues
If the access gates do not disappear after a successful payment:
1. Verify the Stripe Webhook was successfully delivered (check the terminal running `stripe listen`).
2. Verify the Webhook Handler (`/api/webhooks/stripe/route.ts`) processed the event and updated Firestore without errors.
3. Check that the logged-in Firebase User UID matches the UID associated with the Stripe checkout session metadata.
