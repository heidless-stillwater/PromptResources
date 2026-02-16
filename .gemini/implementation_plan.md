# PromptResources - Implementation Plan

## Overview
A web application for hosting educational & reference resources related to AI "prompts". Built with Next.js + Firebase, featuring role-based access control (su/admin/member), multi-format resource management, category/credit systems, and a public API.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, Vanilla CSS (premium dark theme)
- **Backend**: Firebase (Auth, Firestore, Storage, Admin SDK)
- **API**: Next.js API Routes
- **Deployment**: Firebase Hosting / Vercel
- **AI Integration**: NanoBanana API, Gemini API

## Firebase Configuration
- **Project**: heidless-apps-0
- **Database**: promptresources-db-0
- **Auth**: Firebase Auth with email/password + Google sign-in

---

## Phase 1: Project Foundation (MVP Core)

### 1.1 Next.js Project Scaffolding
- [x] Initialize Next.js project with App Router
- [x] Configure Firebase client SDK
- [x] Configure Firebase Admin SDK (server-side)
- [x] Set up environment variables
- [x] Create base CSS design system (dark/premium theme)

### 1.2 Authentication System
- [x] Firebase Auth integration (email + Google)
- [x] Role-based access: su | admin | member
- [x] Auth context provider
- [x] Login/Register pages
- [x] Protected routes middleware
- [x] Role switching for su/admin users
- [x] Default admin: heidlessemail18@gmail.com

### 1.3 Database Schema (Firestore)
```
users/
  {uid}/
    email: string
    displayName: string
    role: "su" | "admin" | "member"
    subscriptionType: "free" | "standard" | "pro"
    createdAt: timestamp
    updatedAt: timestamp

resources/
  {resourceId}/
    title: string
    description: string
    type: "video" | "article" | "tool" | "course" | "book" | "tutorial" | "other"
    mediaFormat: "youtube" | "webpage" | "pdf" | "image" | "audio" | "other"
    url: string
    youtubeVideoId: string (if youtube)
    pricing: "free" | "paid" | "freemium"
    pricingDetails: string (optional)
    categories: string[] (min 1, AI-suggested)
    credits: [{ name: string, url: string }] (AI-suggested)
    platform: "gemini" | "nanobanana" | "chatgpt" | "claude" | "midjourney" | "general" | "other"
    tags: string[]
    addedBy: uid
    createdAt: timestamp
    updatedAt: timestamp
    status: "published" | "draft"

userResources/
  {uid}/
    savedResources: string[] (resource IDs)
    notes: { [resourceId]: string }
    progress: { [resourceId]: "new" | "in-progress" | "completed" }

categories/
  {categoryId}/
    name: string
    description: string
    icon: string
    parentCategory: string (optional)
    createdAt: timestamp
```

---

## Phase 2: Resource Management

### 2.1 Resource CRUD
- [x] Add Resource form with AI category/credit suggestions
- [x] Edit Resource
- [x] Delete Resource
- [x] Resource list with filtering/sorting
- [x] YouTube URL parser & embed optimization

### 2.2 Category System
- [x] Category management (CRUD for su/admin)
- [x] AI-powered category suggestions
- [x] Multi-category assignment
- [x] Category filtering on resource list

### 2.3 Credit System
- [x] Credit/attribution management
- [x] AI-powered credit suggestions
- [x] Multi-credit per resource
- [x] Credit display with links

---

## Phase 3: API & Member Features

### 3.1 Public API
- [x] GET /api/resources - List resources (filtered)
- [x] GET /api/resources/[id] - Single resource
- [x] GET /api/member/[uid] - Member data (placeholder auth)
- [x] API key placeholder system

### 3.2 Member Dashboard
- [x] Personal resource library
- [x] Save/bookmark resources
- [x] Progress tracking
- [x] Notes per resource

### 3.3 Subscription Tiers
- [x] Free / Standard / Pro tiers
- [x] Tiered by storage capacity
- [x] Subscription management UI

---

## Phase 4: Polish & AI Features

### 4.1 AI Integration
- [ ] NanoBanana prompt generation
- [ ] Gemini integration for suggestions
- [x] AI category suggestion on resource add
- [x] AI credit suggestion on resource add

### 4.2 UI/UX Polish
- [x] Premium dark theme with glassmorphism
- [x] Responsive design
- [x] Loading states & animations
- [x] Error handling & toasts

---

## Current Status: Phase 1 - Initial Build
