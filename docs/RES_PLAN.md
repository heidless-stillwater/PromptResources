# PromptResources: SaaS Upgrade Project Plan

This checklist-driven plan outlines the transformation of PromptResources from a client-side prototype into a high-performance, revenue-generating SaaS platform.

## 🏗️ Phase 1: Architectural Foundation (Server-First)
Transform the app from a "thick client" to a high-performance SSR/ISR engine.

- [x] **Migrate to Server Components (RSC)**
  - [x] Update `src/app/page.tsx` to fetch recent resources on the server using `firebase-admin`.
  - [x] Update `src/app/resources/page.tsx` for server-side filtering and pagination.
- [x] Implement ISR (Incremental Static Regeneration)
- [x] Set a 1-hour revalidation window for the public resource gallery.
- [x] **Adopt TanStack Query**
  - [x] Wrap the application with `QueryClientProvider`.
  - [x] Replace `useEffect` data fetching in Dashboard and Settings with `useQuery`.
- [x] **Command Palette (Cmd+K)**
- [x] Implement global search modal for instant resource navigation.

## 🎨 Phase 1.5: Resource Detail Experience
Elevate the core engagement page with premium design and user utility.

- [x] **Premium UI Revamp**
  - [x] Implement glassmorphism and modern design system in `ResourceDetailClient`.
  - [x] Add dynamic breadcrumbs and high-visibility action headers.
- [x] **Immersive Media Integration**
  - [x] Implement YouTube embedded player for video resources.
  - [x] Configure optimized image loading for YouTube thumbnails and Firebase avatars.
- [x] **Private User Utilities**
  - [x] Add **Resource Notes** section with Markdown support.
  - [x] Implement YouTube link extraction tool within the note editor.

## 💳 Phase 2: Revenue & Monetization
Transition from placeholders to a functional billing system.

- [x] **Stripe Infrastructure**
  - [x] Set up Stripe products/prices in the dashboard.
  - [x] Implement Stripe Checkout sessions for Standard/Pro tiers.
- [x] **Subscription Syncing**
  - [x] Create a `/api/webhooks/stripe` route to handle `invoice.paid` and `customer.subscription.deleted`.
  - [x] Update Firestore user documents with `plan` and `stripeCustomerId` fields.
- [x] **Feature Gating**
  - [x] Implement usage-based gating (3/day limit) for "Magic AI" extraction for free users.
- [x] **Customer Portal**
  - [x] Integrated Stripe Customer Portal for self-service billing management.
- [x] **Ecosystem Orchestration**
  - [x] Pivot `PromptTool` to the **Central Hub** of the Stillwater Pro Suite.
  - [x] Implement **Ecosystem Matrix** in the Hub Dashboard for global status monitoring.

## 🧠 Phase 3: AI Intelligence & Discovery
Elevate the search and curation experience using modern AI patterns.

- [x] **AI Enrichment Pipeline**
  - [x] Integrated Gemini API for automated resource analysis.
  - [x] Implemented "Magic AI Autofill" for titles, descriptions, and tags.
  - [x] Added admin-side enrichment for historical resource grooming.
- [ ] **Semantic Vector Search**
  - [ ] Integrate **Upstash Vector** or **Pinecone**.
  - [ ] Set up an indexing job to convert prompt descriptions into embeddings.
  - [ ] Replace text-match search with similarity-based discovery.
- [ ] **Pro Discovery Hub**
  - [ ] Implement AI recommendation engine for "Similar Resources".

---

**Current Status**: 🟢 Phase 1, 1.5, & 2 Complete | Phase 3 In Progress  
**Architecture**: `PromptTool` (Central Hub) | `PromptResources` (Satellite Node) | `PromptMaster` (Registry)  
**Next Step**: Phase 3 - Implementing Semantic Vector Search for conceptual discovery.
