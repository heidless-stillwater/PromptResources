# Creator Attribution System — Phase 1-3 Verification Checklist

This document provides a comprehensive manual verification guide for the **Creator Attribution System**. Follow these steps to ensure data integrity and a premium UI experience.

---

## 1. Data & Migration (Phase 1)
- [x] **Run Migration Script**: Execute `npx ts-node scripts/migrate-credits-to-attributions.ts`.
  - *Expected*: Success message "Migration complete. Updated 68 resources."
- [x] **Firestore Collection Check**: Open Firebase Console -> `resources` collection.
  - *Expected*: Documents should have an `attributions` array (instead of `credits`) and an `attributedUserIds` array for indexed lookups.
- [x] **Firestore Rules**: Check `firestore.rules`.
  - *Expected*: `users` collection has `allow read: if true;` for public profiles.
- [x] **Firestore Indexes**: Check `firestore.indexes.json`.
  - *Expected*: Composite indexes for `users` (isPublicProfile, isFeatured, resourceCount) are present.

## 2. Codebase & Type Safety
- [x] **TypeScript Check**: Run `npx tsc --noEmit`.
  - *Expected*: Zero errors. No remaining references to `Credit` interface or `credits` field.
- [ ] **Next.js Build**: Run `npm run build`.
  - *Expected*: Build completes successfully, confirming SSR routes (`/creators`, `/creators/[slug]`) are valid.

## 3. Landing Page — Discovery (Phase 3)
- [x] **Featured Creators Strip**: Navigate to `http://localhost:3002/`.
  - *Expected*: A new "Our Top Creators" section exists above the footer.
  - *Expected*: Each creator card shows avatar, name, and resource count.
  - *Expected*: Clicking a creator card navigates to `/creators/[slug]`.
  - *Expected*: "View Directory →" link navigates to `/creators`.

## 4. Resource Display — Cards & Detail (Phase 3)
- [x] **Resource Card Footer**: Browse `http://localhost:3002/resources`.
  - *Expected*: Cards show a `CreatorChip` (primary creator) AND an "Added by" (submitter) line.
  - *Expected*: Submitter avatar is slightly smaller (16px) for visual hierarchy.
- [x] **Resource Detail — Attribution**: Click any resource to view details.
  - *Expected*: The "Attribution" section uses the new rich `CreatorChip` style.
  - *Expected*: Hovering over a chip shows a subtle lift/glow effect.
  - *Expected*: Clicking a chip with a `userId` goes to their profile; clicking an external link opens in a new tab.

## 5. Creator Directory (Phase 2)
- [x] **Directory View**: Navigate to `http://localhost:3002/creators`.
  - *Expected*: "Creator Directory" header with glassmorphism hero banner.
  - *Expected*: Search bar filters creators by name/bio in real-time.
  - *Expected*: Type filters (Individual, Channel, Organization) correctly segment the results.
  - *Expected*: Featured creators appear in a distinct gold-bordered strip at the top.

## 6. Creator Profile Page (Phase 2)
- [x] **Profile Layout**: Navigate to `http://localhost:3002/creators/[valid-slug]`.
  - *Expected*: Large hero banner (default gradient or custom URL).
  - *Expected*: Stats row displays live counts for Resources, Categories, etc.
  - *Expected*: "Expertise" tags link back to filtered resource listings.
  - *Expected*: "Authored" vs "Curated" tabs show relevant resource grids.
- [x] **SEO Check**: Hover over the browser tab to see the title.
  - *Expected*: `<title>` includes the creator's name.

---

## 7. Admin Creator Management (Phase 4)
- [ ] **Data Backfill Executed**: Run `npx ts-node scripts/backfill-creators.ts`.
  - *Expected*: Existing string attributions are automatically converted to Stub profiles and linked securely. Wait for confirmation.
- [ ] **Admin Dashboard Update**: Navigate to `http://localhost:3002/admin`.
  - *Expected*: Check the "Overview" tab. Does the upper stat grid now include counting "Creators"?
  - *Expected*: Look in Quick Actions. Does the "🎨 Manage Creators" button appear?
- [ ] **Creator Manager View**: Click "Manage Creators" or visit `/admin/creators`.
  - *Expected*: A clean UI list of creators (public profiles + stubs).
  - *Expected*: Test toggling "⭐ Featured" on any user and refreshing the homepage to verify it pins them.
  - *Expected*: Test the "➕ Add External Stub" form to manually add a creator and verify they appear in the Directory (`/creators`).*: [PASS / FAIL]
