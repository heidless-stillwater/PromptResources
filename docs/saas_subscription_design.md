# SaaS Subscription Architecture: "The Prompt Suite"

## 🎯 Objective
Enable a unified checkout experience using a single Stripe account while controlling access to multiple independent apps (PromptResources, PromptTool, PromptMaster).

## 🏗️ 1. Core Identity & Entitlements
Designate **PromptResources** (Database: `(default)`) as the "Home" for user identity and subscription state.

### User Entitlements Schema
```typescript
interface UserProfile {
  uid: string;
  // ... existing fields ...
  subscriptions: {
    bundleId: string;           // e.g., 'full-suite', 'studio-only'
    status: 'active' | 'past_due' | 'canceled';
    activeSuites: string[];     // e.g., ['resources', 'studio', 'registry']
    currentTier: 'free' | 'pro';
    expiresAt: Date;
  }
}
```

## 💳 2. Stripe Integration
- **Single Stripe Account**: Use one account with multiple **Products** and **Prices**.
- **Metadata**: Attach `suite_types` (comma-separated list) to each Stripe Product metadata.
- **Webhook Handler**: Centralized in the "Home" app. It parses the product metadata and updates the `activeSuites` array in the User Profile.

## 🔐 3. Multi-App Authorization Flow
Every app in the ecosystem follows this "Gatekeeper" pattern:

1. **User Connects**: All apps share the same Firebase Auth project (Common Login).
2. **Subscription Check**:
   - The app's backend uses `firebase-admin` to query the **Profile Database** (e.g., `(default)`) regardless of which database the app itself uses.
   - Example: **PromptTool** (fetching from its own DB) checks `adminDb.collection('users').doc(uid)` in the `(default)` DB.
3. **Graceful Degradation**: If the user is `free` or doesn't have the `studio` suite, the UI shows a "Premium Feature" or "Upgrade" modal that links back to the main pricing page in **PromptResources**.

## 🚀 4. Implementation Steps
- [ ] **Stripe Webhook**: Implement at `/api/webhooks/stripe`.
- [ ] **Cross-DB Helper**: Export a function `getUserEntitlements(uid)` that explicitly specifies the database ID to fetch from.
- [ ] **App Guard Middleware**: Implement Next.js Middleware in each app to check for the required `activeSuite` before allowing access to premium routes.

## 💰 Cost Optimization Notes
- **Caching**: Store the entitlement state in a secure cookie or JWT claim so every page load doesn't require a cross-database lookup.
- **Trigger-based updates**: Only update the "Identity Store" on Stripe events (Webhook).
