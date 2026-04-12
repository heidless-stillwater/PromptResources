# API_PLAN_1 — Unified Ecosystem Configuration System

> **Status**: ✅ Finalized  
> **Scope**: Cross-App Suite (`PromptTool`, `PromptResources`, `PromptMasterSPA`)  
> **Architect**: Antigravity (Assistant)  
> **Date**: 2026-04-12

---

## 🎯 Objective
Implement a "Single Source of Truth" for API keys and global configurations across the Stillwater Stillwater suite. This allows the Admin to update keys (Gemini, Stripe, OpenAI, etc.) via a unified UI in the master app without requiring manual `.env` updates or redeployments for the satellite apps.

---

## 🏗️ Technical Decisions (Finalized)

### 1. The Master App: `PromptTool`
**PromptTool** is the master configuration hub. All secrets are managed here and pushed to a central Firestore store.

### 2. Security: AES-256 Encryption
All secret values saved to the database will be encrypted using `AES-256-GCM`.
- **Master Key**: A `CONFIG_ENCRYPTION_KEY` must be present in the local `.env` of every app that needs to decrypt the secrets.
- **DB State**: If you view the Firestore console, the values will look like `v2:hex-string-of-cipher-text`.

### 3. Performance: 5-Minute In-Memory Cache
To avoid redundant database reads and minimize latency:
- Once a secret is decrypted, it is cached in memory for **5 minutes**.
- Every app in the suite implements this caching logic locally.

### 4. Scope: Strictly Global
Configurations are suite-wide. There are no app-specific overrides in this version. One `GEMINI_API_KEY` applies to all apps connected to the `heidless-apps-0` project.

---

## 🛠️ Implementation Phases

### Phase 1: Cryptography Utility
- Build a robust `src/lib/crypto.ts` that handles standard encryption/decryption with `crypto.subtle` or `crypto` (node).
- Add `CONFIG_ENCRYPTION_KEY` to `.env.local`.

### Phase 2: Admin API & Dashboard (`PromptTool`)
- Create a collection `system_config` with a document `global_secrets`.
- Build an Admin UI in `PromptTool` to manage these keys.

### Phase 3: Consumer Integration (`PromptResources`, `PromptMasterSPA`)
- Implement the `getSecret(keyName)` helper.
- Update AI and Billing modules to use `await getSecret('GEMINI_API_KEY')` with the `.env` fallback.

---

## 📐 Final Checklist

- [x] Architecture Validated (Hierarchical fallback)
- [x] Security Standard Defined (AES-256)
- [x] Caching Strategy Defined (5-min TTL)
- [ ] Implement Phase 1: Cryptography Utility
- [ ] Implement Phase 2: Admin Dashboard
- [ ] Implement Phase 3: App Integration

---

## ❓ Clarification Questions for the USER

To ensure this is perfectly tailored to your needs, please clarify:

1. **Shared Database Access**: Do all three apps currently have the `FIREBASE_ADMIN_PRIVATE_KEY` for the `heidless-apps-0` project? (My inspection suggests yes, but confirming).
2. **Encryption level**: Are you comfortable with keys being stored as plain text in a restricted Firestore collection, or should we implement an extra layer of AES-256 encryption using a "Master Key" (which would still live in `.env`)?
3. **App-Specific Overrides**: Should a satellite app be able to "override" a global key for its own use, or is it strictly "Global or nothing"?
4. **Triggered Reloads**: When you update a key in `PromptTool`, should the other apps "automatically" pick it up within minutes, or are you okay with a manual "Refresh Config" button in their respective admins?

---

## 📐 Implementation Checklist (High-Level)

- [ ] **Infrastructure**: Define Firestore security rules for `system_config`.
- [ ] **Admin UI**: Build `ConfigDashboard.tsx` in `PromptTool`.
- [ ] **Server Logic**: Build `/api/admin/config` secure endpoints.
- [ ] **Client Utility**: Build `getSecrets()` server-helper with caching.
- [ ] **Migration**: Move current `GEMINI_API_KEY` from `.env` to the new DB store.

---

**Next Step**: Based on your answers to the questions above, I will begin building the `ConfigDashboard` in **PromptTool**.
