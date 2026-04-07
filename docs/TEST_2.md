# TEST_2 — Creator Management & Attribution Validation Plan

This document outlines the manual verification steps required to ensure the stability and accuracy of the **Creator Attribution** and **Community Registry** systems.

## 🏁 Prerequisites
- Access to the Admin Dashboard (`/admin/creators`).
- A test resource you are willing to modify or create.
- Terminal access to verify logs if needed.

---

## 🧪 Test Scenarios

### 1. Admin Bulk Sync & Manual Refresh
**Goal**: Verify that denormalized stats can be force-refreshed across the platform.

- [ ] Navigate to `/admin/creators`.
- [ ] Find a creator and click the **🔄 Sync Stats** button (refresh icon) in their row.
- [ ] Confirm the success alert appears.
- [ ] Check the `Resources` column in the table for updated Authored/Curated counts.
- [ ] Click the **🔄 Sync All Stats** button at the top header.
- [ ] Confirm the confirmation prompt and wait for the "All creators synced!" alert.

### 2. Stub Creation & SEO Slug Generation
**Goal**: Verify automated external profile generation.

- [ ] In `/admin/creators`, click **➕ Add External Stub**.
- [ ] Type a name (e.g., `Prompt King`).
- [ ] Verify the **Custom Slug** automatically populates as `prompt-king`.
- [ ] Change the **Type** to `Organization`.
- [ ] Click **Save Stub**.
- [ ] Refresh the page and search for `Prompt King` to verify existence.

### 3. Reactive Attribution Logic (Full Lifecycle)
**Goal**: Verify that adding/removing resources updates counts in real-time.

- [ ] Create a new resource at `/resources/new`.
- [ ] Under **Attribution**, select an existing creator (e.g., `Kevin Stratvert`).
- [ ] Submit the resource.
- [ ] Navigate back to `/admin/creators` (or check the public directory).
- [ ] Verify the `authoredCount` (✍️) for that creator has incremented by 1.
- [ ] Delete that test resource.
- [ ] Verify the count has decremented back to the original value.

### 4. Community Registry Discovery
**Goal**: Verify the public search and sorting system.

- [ ] Navigate to `/creators`.
- [ ] Use the search bar to search for a specific name.
- [ ] Toggle sorting to **Most Authored** (✍️) — verify the list re-orders correctly.
- [ ] Toggle sorting to **Top Curators** (📂) — verify the list re-orders (hunters at top).
- [ ] Toggle sorting to **Newest Members** (✨).
- [ ] Change filter chips between `All`, `Individual`, and `Channel`.

### 5. Profile Page Data Aggregation
**Goal**: Verify complex data joins on the SSR profile page.

- [ ] Click on a creator from the directory to view `/creators/[slug]`.
- [ ] Verify the **Hero** section shows the correct bio and type icon.
- [ ] Look at the categories list (e.g., "Education", "Tutorials").
- [ ] Count the resources in the grid and verify they match the `Total Resources` stat in the hero.
- [ ] Check that clicking a resource in the grid leads to the correct detail page.

---

## 🚩 Reporting Issues
If any counts do not match or the sync fails, please check the server logs:
`tail -f logs/server.log` (or check the browser console for /api/admin/creators/sync failures).
