# PromptResources: SaaS Upgrade Project Plan

This checklist-driven plan outlines the transformation of PromptResources from a client-side prototype into a high-performance, revenue-generating SaaS platform.

## 🏗️ Phase 1: Architectural Foundation (Server-First)
Transform the app from a "thick client" to a high-performance SSR/ISR engine.

- [x] **Migrate to Server Components (RSC)**
  - [x] Update `src/app/page.tsx` to fetch recent resources on the server using `firebase-admin`.
  - [ ] Update `src/app/resources/page.tsx` for server-side filtering and pagination.
- [ ] **Implement ISR (Incremental Static Regeneration)**
  - [ ] Set a 1-hour revalidation window for the public resource gallery.
- [ ] **Adopt TanStack Query**
  - [ ] Wrap the application with `QueryClientProvider`.
  - [ ] Replace `useEffect` data fetching in Dashboard and Settings with `useQuery`.
- [ ] **Command Palette (Cmd+K)**
  - [ ] Implement global search modal for instant resource navigation.

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

- [ ] **Stripe Infrastructure**
  - [ ] Set up Stripe products/prices in the dashboard.
  - [ ] Implement Stripe Checkout sessions for Standard/Pro tiers.
- [ ] **Subscription Syncing**
  - [ ] Create a `/api/webhooks/stripe` route to handle `invoice.paid` and `customer.subscription.deleted`.
  - [ ] Update Firestore user documents with `plan` and `stripeCustomerId` fields.
- [ ] **Feature Gating**
  - [ ] Implement middleware/hooks to restrict "Magic AI" more than 3 times for free users.
  - [ ] Restrict high-tier categories to "Pro" users only.
- [ ] **Customer Portal**
  - [ ] Integrate Stripe Customer Portal for subscription management.

## 🧠 Phase 3: AI Intelligence & Discovery
Elevate the search and curation experience using modern AI patterns.

- [ ] **Semantic Vector Search**
  - [ ] Integrate **Upstash Vector** or **Pinecone**.
  - [ ] Set up an indexing job to convert prompt descriptions into embeddings.
  - [ ] Replace text-match search with similarity-based discovery.
- [ ] **AI Enrichment Pipeline**
  - [ ] Automate tag extraction for new YouTube submissions using Gemini API.
  - [ ] Implement "Similar Prompts" recommendation engine on individual resource pages.
- [ ] **Browser Extension (MVP)**
  - [ ] Build a basic Chrome Extension to "Save to PromptResources" from YouTube/Twitter.

## 🛠️ Phase 4: Operations & Reliability
Ensure the platform is observable, searchable, and production-ready.

- [ ] **Error Tracking & Logging**
  - [ ] Integrate **Sentry** for client and server-side crash reporting.
- [ ] **Product Analytics**
  - [ ] Setup **PostHog** to track user conversion funnels and platform engagement.
- [ ] **SEO Optimization**
  - [ ] Implement `generateMetadata` for dynamic resource pages.
  - [ ] Inject **JSON-LD Schema Markup** (Video, Article, Course) for Google Rich Results.
- [ ] **Legal & Compliance**
  - [ ] Replace placeholder Terms and Privacy pages with dynamic, governed content.

---

**Current Status**: 🟡 In Progress  
**Next Step**: Phase 1 - Server-side searching and pagination for the Resource Gallery.
