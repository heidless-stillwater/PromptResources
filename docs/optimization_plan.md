# Implementation Plan: Cost Optimization & SaaS Suite Hardening

## 🎯 Goal
Reduce Firestore read costs by 90% for search operations and establish a scalable cross-app entitlement system for the "Prompt Suite" subscription model.

---

## 🏗️ 1. Firestore Search Optimization (Cost-Focused)
The current search logic fetches 1,000 documents to perform in-memory filtering. This is a primary cost driver.

### Changes:
- [ ] **Data Model Update**: Add a `searchKeywords` array (string[]) to the `Resource` type. 
    - This will contain lowercase tokens from the Title and Category.
- [ ] **Refine `getResourcesAction`**:
    - Remove `MAX_DOCS_TO_SCAN`.
    - If search is present, use `where('searchKeywords', 'array-contains-any', tokens)`.
    - Fallback to "Category-only" filtering if no search term is found.
- [ ] **Migration Script**: Create a utility to backfill `searchKeywords` for existing resources.

---

## 💳 2. Unified SaaS Subscription Architecture
Since you use a single Stripe account for multiple "distinct databases," we need a "Truth Store" for entitlements.

### Changes:
- [ ] **Identity Centralization**: Designate the `(default)` database as the "Global Identity Store."
- [ ] **Entitlement Schema**:
    ```typescript
    interface UserRoleMetadata {
        activeSuites: ('discovery' | 'studio' | 'registry')[];
        tier: 'free' | 'standard' | 'pro';
        stripeCustomerId?: string;
        expiresAt: Date;
    }
    ```
- [ ] **Cross-App Auth Hook**: Create a server-side helper that can be copied to `PromptTool` and `PromptMaster` to verify subscriptions against the Global Identity Store.

---

## ⚡ 3. Performance & Clean-up
- [ ] **Cloud Function Migration**: (Optional but recommended) Move `syncCreatorStats` to a Firestore trigger to prevent redundant reads during manual synchronization.
- [ ] **Caching Layer**: Implement a 5-minute memory cache for "Public Directory" counts to avoid repeated aggregations.

---

## 🧪 Verification Plan
1. **Search Efficiency Test**: Measure document reads in Firebase console before and after a 10-query search sequence.
2. **Subscription Flow**: Simulate a Stripe Webhook and verify that access is granted across all apps in the suite.
3. **Stub Creation**: Verify that `resolveAttributions` doesn't create duplicate stubs or perform redundant reads on existing records.
