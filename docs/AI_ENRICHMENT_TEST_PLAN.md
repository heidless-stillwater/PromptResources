# Manual Verification Plan: AI Enrichment Pipeline

This plan outlines the steps required to verify the Gemini-powered AI metadata enrichment system across the PromptResources platform.

## 🛠️ Prerequisites
- [ ] Ensure `GEMINI_API_KEY` is set in `PromptResources/.env`.
- [ ] Applications running: `PromptResources` (Port 3002).
- [ ] User is logged in (Admin status required for full edit testing).

---

## 🧪 Test Suite 1: New Resource Submission
**Objective**: Verify that the "Magic AI Autofill" correctly parses external content.

1.  **YouTube Integration**
    - [ ] Navigate to `/resources/new`.
    - [ ] Paste a YouTube URL (e.g., a Gemini guide or Midjourney tutorial).
    - [ ] Click **✨ Magic AI Autofill**.
    - [ ] **Expectation**:
        - Title, Description, and Tags are populated within 3-5 seconds.
        - Categories (e.g., "Video Generation", "Prompt Engineering") are auto-selected.
        - Attribution (Channel Name + Link) is added to the creator list.
        - The "Sync Channel" spinner displays during the fetch.

2.  **Article/Webpage Integration**
    - [ ] Refresh the page and paste a technical blog post URL (e.g., OpenAI or Anthropic blog).
    - [ ] Click **✨ Magic AI Autofill**.
    - [ ] **Expectation**:
        - Gemini analyzes the context and provides a professional summary.
        - Relevant technical tags (e.g., "LLM", "RAG") are added.
        - "Article" type is correctly identified.

---

## 🧪 Test Suite 2: Admin Resource Grooming
**Objective**: Verify that admins can enrich existing "thin" metadata.

1.  **In-Place Enrichment**
    - [ ] Navigate to an existing resource detail page.
    - [ ] Click **✏️ Edit**.
    - [ ] Locate any empty fields (Description or Tags).
    - [ ] Click the individual **✨ AI Suggest** button next to the field.
    - [ ] **Expectation**: Only the targeted field is updated without overwriting other manual edits.

2.  **Full Metadata Reset**
    - [ ] Clear the Title and Description of an existing resource.
    - [ ] Click the primary **✨ Magic AI Autofill** button at the top of the section.
    - [ ] **Expectation**: All fields are reconstructed based *only* on the URL.

---

## 🧪 Test Suite 3: Security & Edge Cases
**Objective**: Ensure the pipeline is robust and gated.

1.  **Authentication Guard**
    - [ ] Open a Private/Incognito window or log out.
    - [ ] Navigate to `/resources/new`.
    - [ ] Attempt to use the AI autofill feature.
    - [ ] **Expectation**: The user should be redirected to login, or the buttons should be appropriately disabled/hidden.

2.  **Invalid URL Handling**
    - [ ] Enter a nonsense string or a local/broken URL (e.g., `https://example.invalid`).
    - [ ] Click **✨ Magic AI Autofill**.
    - [ ] **Expectation**: An error message appears (e.g., "AI Enrichment failed" or "Invalid URL") and the UI remains stable.

3.  **Loading & Interactivity**
    - [ ] During an AI fetch, verify that the button enters a `loading` state.
    - [ ] Verify that the button is `disabled` while the request is in flight to prevent double-submissions.

---

## 📊 Success Metrics
| Feature | Pass/Fail | Notes |
| :--- | :--- | :--- |
| Title Optimization | [ ] | Polished & branded? |
| Tag Relevance | [ ] | Semantic vs Keyword? |
| Category Assignment | [ ] | Matches taxonomy? |
| Attribution Accuracy | [ ] | Creator identified? |
| Latency | [ ] | Under 5 seconds? |

---

**Tester**: ____________________  
**Date**: 2026-04-08  
**Status**: 🟡 Ready for Execution
