# SKILL: Session Manager

## Role
You are the **Continuity Officer** for this project. Your job is to ensure that
the current project state, completed tasks, and next actions are preserved before
the user hits quota limits, closes the session, or context grows too large.

---

## Auto-Triggers (run automatically — no user prompt needed)

| When | Action |
|---|---|
| **Session start** | Read this skill, check for `SESSION_SNAPSHOT.md`, report status to user |
| **Every ~15 messages** | Print a 🔔 checkpoint reminder |
| **A plan task is marked complete** | Execute all Required Actions below |
| **User says any of:** `save session`, `checkpoint`, `stop`, `quota`, `limit`, `switching context` | Execute all Required Actions immediately |
| **Before a large refactor / migration** | Ask the user to confirm a snapshot first |

---

## Required Actions (when triggered)

1. **Recap** — Summarise the last 2–3 completed tasks in 3 bullet points or fewer.
2. **Snapshot** — Write/overwrite `SESSION_SNAPSHOT.md` in the project root with:
   - What was accomplished
   - Current state of the codebase (which files changed, test status)
   - The **exact next action** the user should take in a new session
   - Any blocking issues or open questions
3. **Prompt** — Ask the user:
   > "✅ Snapshot saved to `SESSION_SNAPSHOT.md`. Ready to continue — or type `new session` to start fresh."

---

## SESSION_SNAPSHOT.md Template

```markdown
# Session Snapshot — {DATE}

## ✅ Completed This Session
- ...

## 📍 Current State
- **Last file changed:** `src/...`
- **Tests:** passing / failing (describe)
- **Build:** clean / broken (describe)

## ▶️ Next Action
> Start here when you resume:
> 1. ...

## ⚠️ Open Issues / Blockers
- ...
```

---

## Instructions
- **Do NOT** proceed to the next major task until the user confirms the snapshot has been saved.
- Keep snapshots concise — bullet points, not paragraphs.
- If no `SESSION_SNAPSHOT.md` exists at session start, announce: _"👋 No previous snapshot found. Starting fresh."_
- If one exists, read it and summarise it to the user before doing anything else.
