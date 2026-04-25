# Manual Verification Test Plan: PromptResources Accreditation Integration
**Version**: 1.0.0 (RESOURCE_ACCREDIT_TST_0)
**Scope**: Unified Audit Logging, Multi-Policy Detection, Content Moderation, Sovereign UI Heartbeat.

---

## 1. Executive Summary
This test plan validates the integration of the **PromptAccreditation** framework into **PromptResources**. It ensures that the application correctly responds to regulatory signals (GATT), logs critical safety events to the central registry, and allows users to participate in content moderation through the flagging system.

## 2. Test Environment
- **App**: `PromptResources` (Port 3002)
- **Central Registry**: `PromptAccreditation` (Cloud Console / Firestore)
- **User Role**: Standard Member (for flagging/AV) and Admin (for policy status).

---

## 3. Test Scenarios

### Scenario A: Sovereign UI Heartbeat (Accreditation Center)
**Objective**: Verify the live status of clinical safety measures on the dashboard.
1. **Step**: Navigate to `/dashboard`.
2. **Step**: Locate the "Accreditation Center" card.
3. **Expectation**: Card displays "Status: green" (assuming no active breaches in Firestore).
4. **Expectation**: Card shows "All clinical safety measures verified" with an emerald checkmark.

### Scenario B: Multi-Policy Breach Detection (Amber Drift)
**Objective**: Verify the system handles multiple simultaneous non-blocking alerts.
1. **Step**: (Manual Setup) In Firestore `accreditationDb`, set two policies to status `amber`.
2. **Step**: Refresh `PromptResources` dashboard.
3. **Expectation**: Sovereign Sentinel displays a stack of two alerts in the top-right corner.
4. **Expectation**: Accreditation Center lists both policies with their specific drift messages.

### Scenario C: Content Moderation (Asset Flagging)
**Objective**: Verify the user-driven reporting flow and audit log anchoring.
1. **Step**: Navigate to any Resource Detail page (`/resources/[id]`).
2. **Step**: Click the "Report" button (Shield icon).
3. **Expectation**: `FlagModal` appears with regulatory breach categories.
4. **Step**: Select a reason (e.g., "Illegal Content"), add details, and submit.
5. **Expectation**: Success Toast appears: "Report submitted successfully."
6. **Expectation**: (Verification) Check `PromptResources` Firestore `flags` collection for the new entry.
7. **Expectation**: (Verification) Check `PromptAccreditation` Firestore `audit_log` for the `CONTENT_FLAGGED` event.

### Scenario D: Unified Audit (AV Verification)
**Objective**: Verify that completing a safety challenge anchors an event to the central registry.
1. **Step**: (Manual Setup) Enable `avEnabled` in `system_config/protection`.
2. **Step**: Navigate to any page in `PromptResources`.
3. **Expectation**: `AgeVerificationModal` appears.
4. **Step**: Complete the verification (e.g., click "I am over 18").
5. **Expectation**: Modal closes and session is anchored.
6. **Expectation**: (Verification) Check `PromptAccreditation` Firestore `audit_log` for the `AV_VERIFIED` event.

---

## 4. Progress Tracking
- [ ] Scenario A: UI Heartbeat
- [ ] Scenario B: Multi-Policy Detection
- [ ] Scenario C: Content Moderation
- [ ] Scenario D: Unified Audit

---

## 5. Feedback Loop
> [!NOTE]
> Please indicate if any step fails to produce the expected visual or telemetry result. Status updates will be provided after each scenario.
