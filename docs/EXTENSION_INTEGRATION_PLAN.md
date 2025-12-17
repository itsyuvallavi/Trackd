## Chrome Extension ↔ Trackd Auth & Integration Plan

### Goal

Implement a **full OAuth-style flow** so the Chrome extension is automatically linked to the same Trackd account as the web app, and can save jobs directly into that user’s data.

---

## 1. Architecture & Data Flow

- **Auth model**
  - Use the existing web authentication (Supabase / future auth) to issue a short-lived **extension auth code**, which the extension exchanges for a longer-lived **extension access token**.
  - The extension access token maps to a `userId` in the backend and is used to authenticate `POST /api/jobs/from-extension`.

- **High-level flow**

  1. User logs into Trackd in the browser.
  2. In Trackd UI (e.g. Settings → Integrations) user clicks **“Connect Chrome Extension”**.
  3. Web app requests a one-time **auth code** from the backend.
  4. Web app shows the code and instructions: “Paste this into the extension”.
  5. User opens the extension popup and pastes the code.
  6. Extension calls a backend endpoint to **exchange the code for an access token**, and stores it.
  7. When the user clicks **Save job** in the extension, it calls `POST /api/jobs/from-extension` with `Authorization: Bearer <extensionToken>`.
  8. Backend resolves `userId` from the token and creates the job + activity for that account.

---

## 2. Backend: Data Model & Token Handling

### 2.1 New DB models

Add to `prisma/schema.prisma`:

- **`ExtensionToken`**
  - `id` (cuid)
  - `userId` (FK to user; initially can be `TEMP_USER_ID` until real auth is wired)
  - `tokenHash` (hashed access token)
  - `expiresAt` (nullable for now)
  - `lastUsedAt`
  - `createdAt`, `updatedAt`

- **`ExtensionAuthCode`** (one-time codes)
  - `id` (cuid)
  - `userId`
  - `codeHash`
  - `expiresAt` (short, e.g. 10 minutes)
  - `usedAt` (nullable)
  - `createdAt`

### 2.2 Helper utilities

Create `src/lib/extension-auth.ts`:

- `createAuthCodeForUser(userId)`
  - Generates random code, stores `codeHash` + `userId` + `expiresAt`.
  - Returns plain `code` (never stores it in cleartext).
- `exchangeCodeForToken(code)`
  - Looks up `ExtensionAuthCode` by `codeHash`.
  - Verifies not expired / not used.
  - Marks code as used.
  - Creates `ExtensionToken` row and returns plain `extensionAccessToken` + `userId`.
- `validateExtensionToken(token)`
  - Looks up `ExtensionToken` by `tokenHash`.
  - Verifies not expired.
  - Returns `userId` or `null`.

Hashing strategy: use a standard one-way hash so leaked DB does not expose tokens.

---

## 3. Backend: API Endpoints

### 3.1 Issue auth code endpoint

**File:** `src/app/api/extension/auth/code/route.ts`

- **Method:** `POST`
- **Usage:** Called from the web app when the user clicks “Connect Chrome Extension”.
- **Behavior:**
  - Validates user session (for now, can map to `TEMP_USER_ID`; later use real auth).
  - Calls `createAuthCodeForUser(userId)`.
  - Returns `{ code: "<one-time-code>" }` in JSON.

### 3.2 Exchange code for token endpoint

**File:** `src/app/api/extension/auth/exchange/route.ts`

- **Method:** `POST`
- **Usage:** Called by the extension when the user pastes the code and hits “Connect”.
- **Input:** `{ code: "<one-time-code>" }`.
- **Behavior:**
  - Calls `exchangeCodeForToken(code)`.
  - Returns `{ accessToken: "<extension-access-token>", userEmail?: string }`.
- **Errors:**
  - 400 for invalid format.
  - 404/410 for expired or already-used code.

### 3.3 Secure jobs-from-extension endpoint

**File:** `src/app/api/jobs/from-extension/route.ts`

- **Changes:**
  - Require `Authorization: Bearer <extensionAccessToken>` header.
  - Use `validateExtensionToken` to resolve `userId`.
  - Use this `userId` when creating `Job` + `Activity`.
  - If token missing/invalid:
    - Return 401 with `{ error: "Invalid or missing extension token" }`.
- **Transitional behavior:**
  - (Optional) For local testing, keep a `TEMP_USER_ID` fallback when header is missing, but plan to remove it once real auth is ready.

---

## 4. Web App UI Changes

### 4.1 Settings: Extension connection UI

**File:** `src/app/(authenticated)/settings/integrations/page.tsx`

Add an **Extension** section:

- Show status:
  - “Not connected” if no active `ExtensionToken` for this user.
  - “Connected” if at least one active token exists.
- Button: **“Connect Chrome Extension”**.
  - On click:
    - Calls `POST /api/extension/auth/code` (via client component or server action).
    - Displays returned `code` with:
      - Copy button.
      - Short instructions.

### 4.2 Optional: Quick link from onboarding / jobs

- On the jobs page or onboarding completion step, link to:
  - “Install the Chrome extension and connect it using a one-time code from Settings → Integrations → Extension.”

---

## 5. Chrome Extension Updates

### 5.1 Connect UI in the popup

**Files:**

- `browser-extension/popup.html`
- `browser-extension/scripts/popup.js`

Add a **“Connect to Trackd”** section in the popup:

- Fields:
  - **API URL** (default `http://localhost:3000`, editable).
  - **One-time code** input.
- Button **“Connect”**:
  - Reads `apiUrl` + `code`.
  - Calls `POST {apiUrl}/api/extension/auth/exchange` with JSON `{ code }`.
  - On success:
    - Stores `{ extensionAccessToken, apiUrl }` in `chrome.storage.sync`.
    - Clears code input.
    - Shows “Connected” status.

### 5.2 Use token when saving jobs

In the existing job save logic:

- Before calling `/api/jobs/from-extension`, read from `chrome.storage.sync`:
  - `extensionAccessToken`
  - `apiUrl` (fallback to default if missing)
- Send request:
  - URL: `{apiUrl}/api/jobs/from-extension`
  - Headers:
    - `Authorization: Bearer <extensionAccessToken>`
    - `Content-Type: application/json`
- Handle responses:
  - If 401/403:
    - Show a clear message: “Please reconnect the extension from Trackd → Settings → Integrations.”
  - On success:
    - Show success UI (e.g. “Job saved to Trackd”).

### 5.3 Connection status indicator

In the popup header:

- Show a small status indicator:
  - Green dot + “Connected” if a token is present in `chrome.storage.sync`.
  - Red/grey dot + “Not connected” if not.
- (Optional) If `exchange` response includes `userEmail`, show:
  - “Connected as `user@example.com`”.

---

## 6. Security & Lifecycle

### 6.1 Token security

- Backend stores only **hashed** tokens and codes.
- Extension stores plain token in `chrome.storage.sync`:
  - Acceptable for MVP, but document that anyone with access to the machine profile could use it.

### 6.2 Revocation

- In Settings → Integrations → Extension:
  - Add “Revoke all extension tokens” button.
  - Deletes all `ExtensionToken` rows for that user.
  - Instruct user to reconnect if extension stops working.

### 6.3 Expiration (optional for MVP)

- Add `expiresAt` to `ExtensionToken`:
  - Could be long-lived (e.g. 6–12 months).
  - When expired, `validateExtensionToken` fails and extension is asked to reconnect.

---

## 7. Testing Plan

### 7.1 Backend

- Manual tests with `curl` / HTTP client:
  - `POST /api/extension/auth/code` → get `code`.
  - `POST /api/extension/auth/exchange` with that `code` → get `accessToken`.
  - `POST /api/jobs/from-extension` with `Authorization: Bearer <accessToken>` → verify job created for expected `userId`.

### 7.2 Extension

- Install the unpacked extension (current `browser-extension` folder).
- In popup:
  - Set API URL to `http://localhost:3000`.
  - Paste one-time code from Settings.
  - Click “Connect” and see “Connected” state.
- Navigate to a LinkedIn/Indeed job:
  - Open extension.
  - Confirm it extracts job fields.
  - Save job.
  - Verify job appears in `/jobs`, `/board`, `/today` for the same user.

---

## 8. Implementation Todos

- **db-models**: Add `ExtensionToken` and `ExtensionAuthCode` Prisma models and run migration.
- **auth-helpers**: Implement code/token generation & validation in `src/lib/extension-auth.ts`.
- **api-code-endpoint**: Create `POST /api/extension/auth/code` route.
- **api-exchange-endpoint**: Create `POST /api/extension/auth/exchange` route.
- **api-from-extension**: Update `/api/jobs/from-extension` to authenticate via `Authorization: Bearer <extensionToken>` and resolve `userId`.
- **settings-ui**: Add Extension connection UI + “Connect Chrome Extension” button to `settings/integrations`.
- **extension-popup-connect**: Add connect form in `popup.html`/`popup.js` to exchange the code for a token and store it.
- **extension-save-with-token**: Update extension job-save logic to send `Authorization: Bearer <extensionToken>`.
- **testing**: End-to-end test: login → generate code → connect extension → save job via extension → see job in app.
