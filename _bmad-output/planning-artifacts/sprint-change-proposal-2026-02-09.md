# Sprint Change Proposal - Connection Timeout & Cancel

**Date:** 2026-02-09
**Author:** Bob (Scrum Master Agent)
**Status:** Pending Approval
**Change Scope:** Minor
**Priority:** Beta Blocker / Hotfix

---

## 1. Issue Summary

**Problem Statement:** When a user re-enters the IRIS Table Editor extension and the previously selected server is unavailable or unresponsive, the extension hangs indefinitely. There is no timeout on the connection attempt and no cancel mechanism, leaving the user trapped with no way to select a different server or use the extension.

**Discovery Context:** Reported by beta tester during normal usage after a server was taken offline. All 9 epics (52 stories) are complete and shipped to beta. This is a post-implementation reliability defect against existing requirements.

**Evidence:**
- Beta tester report: extension becomes unresponsive on re-entry when server is down
- No cancel UI exists in the connection flow
- Architecture defines `CONNECTION_TIMEOUT` and `SERVER_UNREACHABLE` error codes in ErrorHandler, but the connection flow never triggers them
- NFR4 (non-blocking UI), NFR17 (network disconnect detection), and NFR18 (graceful connection recovery) are violated

---

## 2. Impact Analysis

### Epic Impact

| Epic | Impact |
|------|--------|
| Epic 1 (Foundation & Connection) | **Primary** - Add Story 1.7: Connection Timeout & Cancel |
| Epics 2-5 (Core CRUD) | None directly. Benefit passively from AtelierApiService-level timeout hardening |
| Epic 6 (Scalability) | **Secondary** - Filter, sort, pagination API calls also protected by service-level timeout |
| Epic 7 (Data Type Polish) | None |
| Epic 8 (Keyboard Shortcuts) | None |
| Epic 9 (Export/Import) | **Secondary** - Long-running import/export operations also protected |

### Artifact Impact

| Artifact | Required Changes |
|----------|-----------------|
| **PRD** | Add FR4a: connection timeout + cancel requirement. Strengthen NFR18 to cover re-entry scenario. |
| **Architecture** | Add `cancelConnection` command. Add `AbortController` + timeout pattern to AtelierApiService. Add `connecting` loading context to AppState. |
| **UX Design** | Add "Connecting..." state with progress ring + Cancel button. Add timeout auto-error state with Retry / Select Different Server actions. Update Journey 2 flow. |
| **Epics** | Add Story 1.7 with acceptance criteria. |
| **Sprint Status** | Add Story 1.7 under Epic 1. |

### Technical Impact

- **AtelierApiService** - All `fetch()` calls wrapped with `AbortController` and configurable timeout (default 30s)
- **ServerConnectionManager** - Connection flow supports cancellation, propagates abort signals
- **Webview (main.js)** - New "connecting" UI state with cancel button
- **Message Protocol** - New `cancelConnection` command (webview -> extension)
- **AppState** - New `connecting` loading context with abort reference

---

## 3. Recommended Approach

**Selected Path:** Direct Adjustment - modify/add within existing epic structure.

**Rationale:**
1. **Surgical fix** - Gap is narrow and well-defined. AbortController + timeout on fetch, cancel button in connection UI. No architectural rework.
2. **Zero regression risk** - Adding timeout/abort doesn't change behavior for healthy connections. Only activates when server is slow/unreachable.
3. **Already anticipated** - Architecture has `CONNECTION_TIMEOUT` and `SERVER_UNREACHABLE` error codes defined. ErrorHandler already maps them to user-friendly messages. We're wiring up what was already designed.
4. **Broad hardening** - AtelierApiService-level fix protects every API operation (not just connection) from hanging on an unresponsive server.
5. **Beta blocker** - Fast resolution critical for beta tester experience.

**Alternatives considered:**
- **Rollback (rejected):** Story 1.4 is foundational. Rolling back breaks everything. The issue is incompleteness, not incorrectness.
- **MVP Review (rejected):** MVP is shipped. This is a defect fix, not a scope change. Overkill.

**Effort estimate:** Low
**Risk level:** Low
**Timeline impact:** None - focused fix, does not delay any planned work

---

## 4. Detailed Change Proposals

### 4.1 PRD Changes

**Add FR4a:**

```
OLD: (no requirement)

NEW:
FR4a: Connection attempts must timeout after a configurable period (default: 30 seconds)
and display a cancel option during the attempt. On timeout, the user is presented with
"Retry" and "Select Different Server" options.

Rationale: Beta tester discovered extension hangs indefinitely on unresponsive server.
```

**Strengthen NFR18:**

```
OLD:
NFR18: Extension recovers gracefully from server connection loss

NEW:
NFR18: Extension recovers gracefully from server connection loss, including when
re-entering the extension with a previously selected server that is no longer available.
Connection attempts must be cancellable and time-bounded.

Rationale: Original wording didn't explicitly cover the re-entry reconnection scenario.
```

### 4.2 Architecture Changes

**New Command (add to Command/Event message table):**

| Command | Payload | Description |
|---------|---------|-------------|
| `cancelConnection` | `{}` | Cancel in-progress connection attempt |

**AtelierApiService Enhancement:**

```typescript
// All fetch() calls use AbortController with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**New Loading Context (add to AppState):**

| Context | Description |
|---------|-------------|
| `connecting` | Server connection in progress, cancel affordance available |

### 4.3 UX Design Changes

**New Visual State: "Connecting..."**

```
+---------------------------------------------+
| Connecting to dev-server...                  |
|                                              |
|           [  progress ring  ]                |
|                                              |
|              [ Cancel ]                      |
+---------------------------------------------+
```

**Timeout Error State:**

```
+---------------------------------------------+
| Connection failed                            |
|                                              |
| Could not reach "dev-server" after 10        |
| seconds. The server may be offline.          |
|                                              |
|  [ Retry ]    [ Select Different Server ]    |
+---------------------------------------------+
```

**Journey 2 Update:** Add branch after "Select production server":
- Connecting... (with cancel option)
- Timeout? -> Error state -> Retry or Select Different Server

### 4.4 New Story

**Story 1.7: Connection Timeout & Cancel**

As a **user**,
I want **connection attempts to timeout and offer a cancel option**,
So that **I'm never trapped by an unresponsive server and can always switch to a different one**.

**Acceptance Criteria:**

**Given** I open the extension and it attempts to connect to a previously selected server
**When** the connection is in progress
**Then** I see "Connecting to [server-name]..." with a progress indicator
**And** I see a "Cancel" button

**Given** a connection attempt is in progress
**When** I click "Cancel"
**Then** the connection attempt is aborted immediately
**And** I see the server selection UI
**And** I can select a different server

**Given** a connection attempt is in progress
**When** 10 seconds elapse without a response
**Then** the attempt is automatically cancelled
**And** I see an error: "Could not reach [server-name]. The server may be offline."
**And** I see "Retry" and "Select Different Server" buttons

**Given** I see the timeout error
**When** I click "Retry"
**Then** a new connection attempt begins with the same timeout/cancel flow

**Given** I see the timeout error
**When** I click "Select Different Server"
**Then** I see the server selection UI

**Given** any API operation (query, update, insert, delete) is in progress
**When** the server becomes unresponsive
**Then** the operation times out after 30 seconds
**And** I see a clear error message
**And** the UI remains functional (not frozen)

**Given** the connection timeout setting
**When** a user wants to customize it
**Then** the timeout is configurable via VS Code settings (`iris-table-editor.connectionTimeout`)
**And** the default is 10 seconds

---

## 5. Implementation Handoff

### Change Scope Classification: Minor

This can be implemented directly by the development team. No backlog reorganization or fundamental replan required.

### Action Plan

| Step | Action | Owner | Dependency |
|------|--------|-------|------------|
| 1 | Approve this Sprint Change Proposal | Developer (user) | None |
| 2 | Update PRD (FR4a, NFR18) | PM Agent or direct edit | Approval |
| 3 | Update Architecture (command, AbortController, state) | Architect Agent or direct edit | Approval |
| 4 | Update UX spec (connecting state, timeout error, journey) | UX Agent or direct edit | Approval |
| 5 | Add Story 1.7 to epics document | SM Agent | Steps 2-4 |
| 6 | Update sprint-status.yaml | SM Agent | Step 5 |
| 7 | Implement Story 1.7 | Dev Agent (dev-story) | Step 6 |
| 8 | Code review | Code Review workflow | Step 7 |

### Success Criteria

- Extension never hangs on unresponsive server
- Cancel button aborts connection within 500ms of click
- Timeout fires after configured period (default 30s)
- All API operations (not just connection) are timeout-protected
- User can always reach server selection UI
