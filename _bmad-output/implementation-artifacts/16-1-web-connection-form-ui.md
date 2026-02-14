# Story 16.1: Web Connection Form UI

Status: review

## Story

As a **user**,
I want **a browser-based form to enter IRIS server connection details**,
So that **I can connect to any reachable IRIS server from my browser**.

## Acceptance Criteria

1. When I navigate to the web app URL with no active session, I see a connection form with fields: Host, Port, Path Prefix, Namespace, Use HTTPS checkbox, Username, Password
2. Required fields are marked with asterisks; Port defaults to 52773
3. When I fill in all required fields and click "Connect", credentials are sent to the server via HTTPS, the server tests the connection to IRIS, and on success I am redirected to the main grid view
4. When validation fails (missing required fields), I see inline validation errors for each missing field and the form is NOT submitted
5. A "Remember connection" checkbox saves connection details (host, port, namespace, username — NOT password) to localStorage; these appear in a "Recent Connections" list on next visit

## Tasks / Subtasks

- [x] Task 1: Create web connection form HTML/CSS (AC: 1, 2)
  - [x] 1.1: Create `packages/web/public/index.html` with form fields: Host, Port, Path Prefix, Namespace, Use HTTPS checkbox, Username, Password
  - [x] 1.2: Mark required fields (Host, Port, Namespace, Username, Password) with asterisks
  - [x] 1.3: Set Port default value to 52773
  - [x] 1.4: Style with `--ite-*` CSS variables and BEM classes (`.ite-connection-form__*`)
  - [x] 1.5: Create `packages/web/public/connection-form.css` following desktop connection form patterns

- [x] Task 2: Create web connection form JavaScript (AC: 3, 4)
  - [x] 2.1: Create `packages/web/public/connection-form.js` as IIFE module
  - [x] 2.2: Implement client-side validation: required fields checked before submit, inline error messages
  - [x] 2.3: On "Connect" click: validate → show spinner → POST to `/api/connect` → handle response
  - [x] 2.4: On success: hide connection form, show main grid view (emit navigation event or call router)
  - [x] 2.5: On failure: show error message below form (actionable text from server error)
  - [x] 2.6: Disable form fields and button during connection attempt

- [x] Task 3: Recent connections feature (AC: 5)
  - [x] 3.1: Add "Remember connection" checkbox to form
  - [x] 3.2: On successful connect with "Remember" checked: save host, port, pathPrefix, namespace, username, useHTTPS to localStorage (NOT password)
  - [x] 3.3: On page load: check localStorage for recent connections
  - [x] 3.4: Display "Recent Connections" list below form with saved connections
  - [x] 3.5: Clicking a recent connection pre-fills the form (user enters password only)
  - [x] 3.6: Add "Remove" button on each recent connection entry
  - [x] 3.7: Limit to 5 most recent connections

- [x] Task 4: Serve connection form from web server (AC: 1)
  - [x] 4.1: Update `packages/web/public/index.html` to serve as the SPA shell with connection form
  - [x] 4.2: Include connection form HTML, CSS, JS in the page
  - [x] 4.3: Show connection form when no active session; show placeholder "grid view coming soon" when connected
  - [x] 4.4: Check session status on page load via GET `/api/session`

- [x] Task 5: Wire CSRF token into form submission (AC: 3)
  - [x] 5.1: Fetch CSRF token from GET `/api/csrf-token` on page load
  - [x] 5.2: Include CSRF token in `X-CSRF-Token` header on POST `/api/connect`
  - [x] 5.3: Handle CSRF token refresh if it expires

- [x] Task 6: Write tests (AC: 1-5)
  - [x] 6.1: Create `packages/web/src/test/connectionForm.test.ts`
  - [x] 6.2: Test POST /api/connect with valid credentials returns session (integration test via server)
  - [x] 6.3: Test POST /api/connect with invalid credentials returns error
  - [x] 6.4: Test GET /api/session returns connected/disconnected status
  - [x] 6.5: Test client-side validation logic (unit test the validation function)
  - [x] 6.6: Test recent connections localStorage logic (unit test)
  - [x] 6.7: Run compile + lint + test to validate

## Dev Notes

- Follow the desktop connection form as a blueprint: `packages/desktop/src/ui/connection/server-form.html` and `.js`
- Use vanilla JS (no framework) — same approach as all other webview/client code in the project
- BEM CSS classes: `.ite-connection-form`, `.ite-connection-form__field`, `.ite-connection-form__error`, etc.
- Use `--ite-theme-*` CSS variables for theming (same as webview and desktop)
- Connection form is client-side only (HTML/CSS/JS served as static files)
- The /api/connect endpoint already exists from Story 15.2 — this story creates the UI that calls it
- The CSRF protection from Story 15.4 requires tokens on POST requests
- XSS prevention: use `textContent` for dynamic text, `escapeHtml()` for any user data rendered in HTML
- Screen reader support: use `role="alert"` for error messages, proper `label` elements for form fields

### Project Structure Notes

- Client-side files go in `packages/web/src/client/connection/` (not `public/` — they need to be included in the build)
- OR simpler: put directly in `packages/web/public/` since they're static assets served by Express
- Follow whichever pattern the architecture spec recommends

### References

- [Source: architecture.md#Web Server Architecture] — SPA serving
- [Source: epics.md#Story 16.1] — Acceptance criteria
- [Source: desktop/src/ui/connection/server-form.html] — Desktop connection form (blueprint)
- [Source: desktop/src/ui/connection/server-form.js] — Desktop connection form logic
- [Source: desktop/src/ui/connection/server-form.css] — Desktop connection form styles

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
No debug issues encountered.

### Completion Notes List
- Placed client-side files in `packages/web/public/` as static assets served by Express (simpler approach per story Dev Notes)
- HTML form inlined in `index.html` rather than a separate HTML file — follows SPA shell pattern for the web target
- CSS includes its own dark-theme CSS variables (standalone web has no VS Code host to provide theme tokens, so desktopThemeBridge-style variables are embedded directly)
- JavaScript uses IIFE pattern matching desktop server-form.js, with escapeHtml() for XSS prevention and textContent for dynamic text
- CSRF flow: fetches token on page load from GET /api/csrf-token, includes in X-CSRF-Token header, retries once on 403 with refreshed token
- /api/connect endpoint is exempt from CSRF in security.ts (Story 15.4), so CSRF token is included as defense-in-depth but the initial connect works without one
- Recent connections deduplicate by host+port+namespace+username, limit to 5, stored without password
- Connected view shows "Grid view coming soon" placeholder with disconnect button (grid implementation is a future story)
- Tests: 32 new tests (integration + unit), total test count now 144
- All 144 tests pass, compile clean, lint clean

### File List
- `packages/web/public/index.html` (modified — replaced placeholder with SPA shell containing connection form)
- `packages/web/public/connection-form.css` (new — connection form styles with dark theme variables)
- `packages/web/public/connection-form.js` (new — connection form logic: validation, CSRF, recent connections, session check)
- `packages/web/src/test/connectionForm.test.ts` (new — 32 tests: API integration + validation unit + localStorage unit)
