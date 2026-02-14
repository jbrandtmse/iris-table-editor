# Story 12.4: Credential Storage

Status: review

## Story

As a **developer**,
I want **server credentials stored securely using an encryption abstraction**,
so that **passwords are never stored in plaintext on disk**.

## Acceptance Criteria

1. **Given** a user saves a server with a password, **When** the password is persisted, **Then** it is encrypted before storage **And** the plaintext password is never written to disk

2. **Given** a user connects to a server, **When** the password is needed for authentication, **Then** it is decrypted from storage **And** the plaintext password is only held in memory during the connection attempt

3. **Given** server connection data is stored, **When** I inspect the config data file, **Then** passwords appear as encrypted strings (not readable text) **And** server names, hosts, and ports are stored in plaintext (not sensitive) **And** usernames are stored in plaintext

4. **Given** encryption is available, **When** `credentialStore.isAvailable()` returns true, **Then** encryption is used for all password storage **And** the app functions normally

5. **Given** encryption is NOT available (fallback scenario), **When** `credentialStore.isAvailable()` returns false, **Then** the app warns the user that passwords cannot be securely stored **And** passwords are not persisted (user must re-enter each session)

## Tasks / Subtasks

- [x] Task 1: Create ICredentialStore interface (AC: 1, 2, 4, 5)
  - [x] 1.1: Create `packages/desktop/src/main/ICredentialStore.ts` with interface:
    - `encrypt(password: string): string` — encrypt plaintext password, return base64-encoded encrypted string
    - `decrypt(encrypted: string): string` — decrypt encrypted string, return plaintext password
    - `isAvailable(): boolean` — whether encryption is available on this system
  - [x] 1.2: Export `ICredentialStore` from `packages/desktop/src/index.ts`

- [x] Task 2: Create NodeCryptoCredentialStore implementation (AC: 1, 2, 3, 4)
  - [x] 2.1: Create `packages/desktop/src/main/NodeCryptoCredentialStore.ts`
  - [x] 2.2: Use Node.js `crypto` module: AES-256-GCM encryption
  - [x] 2.3: Derive encryption key using `crypto.scryptSync(machineKey, salt, 32)` where `machineKey` is derived from `os.hostname() + os.userInfo().username` (machine-local binding)
  - [x] 2.4: Store format: `base64(iv + authTag + ciphertext)` — IV (12 bytes) + Auth Tag (16 bytes) + encrypted data
  - [x] 2.5: `isAvailable()` returns `true` (Node.js crypto is always available)
  - [x] 2.6: This is a BRIDGE implementation until Epic 11 adds Electron's `safeStorage` via a `SafeStorageCredentialStore`

- [x] Task 3: Refactor ConnectionManager to use ICredentialStore (AC: 1, 2, 3, 5)
  - [x] 3.1: Add optional `credentialStore?: ICredentialStore` to `ConnectionManagerOptions`
  - [x] 3.2: In `saveServer()`: if credentialStore available, encrypt `encryptedPassword` before storing; if not available, store empty string and log warning
  - [x] 3.3: In `getServer()` / `getServers()`: if credentialStore available, decrypt `encryptedPassword` in returned copies; if not, return empty string
  - [x] 3.4: In `updateServer()`: if new password provided, encrypt it; if empty (edit mode keep-existing), preserve existing encrypted value
  - [x] 3.5: In `testConnection()`: use password from form directly (already plaintext, not stored)
  - [x] 3.6: Add `getDecryptedPassword(serverName: string): string` convenience method for connection flow
  - [x] 3.7: Backward compatibility: if no credentialStore provided, passwords pass through unchanged (existing behavior)

- [x] Task 4: Add credential-related message types (AC: 5)
  - [x] 4.1: Add `IDesktopCredentialWarningPayload` interface: `{ message: string }` for when encryption is unavailable
  - [x] 4.2: Extend `DesktopConnectionEvent` with `credentialWarning` event
  - [x] 4.3: Export from `@iris-te/core`

- [x] Task 5: Write tests (AC: all)
  - [x] 5.1: Unit tests for `NodeCryptoCredentialStore`: encrypt/decrypt round-trip, different passwords produce different ciphertexts, decrypt with wrong key fails, isAvailable returns true
  - [x] 5.2: Unit tests for `ConnectionManager` with credential store: save encrypts password, getServer decrypts password, updateServer handles password change/keep, getDecryptedPassword works
  - [x] 5.3: Unit tests for `ConnectionManager` without credential store (backward compat): passwords pass through unchanged
  - [x] 5.4: Unit tests for `ConnectionManager` with unavailable credential store: passwords not persisted, warning logged
  - [x] 5.5: Tests in `packages/desktop/src/test/`

- [x] Task 6: Validate (AC: all)
  - [x] 6.1: Run `npm run compile` — all packages compile
  - [x] 6.2: Run `npm run lint` — no new lint errors
  - [x] 6.3: Run `npm run test` — all tests pass
  - [x] 6.4: Verify packages/desktop has no `vscode` imports
  - [x] 6.5: Verify encrypted passwords in test JSON files are not readable plaintext

## Dev Notes

### Architecture Context

The architecture specifies `safeStorage` from Electron for credential encryption. Since Electron is not yet installed (added in Epic 11), this story creates an abstraction layer (`ICredentialStore`) with a Node.js `crypto` implementation as a bridge.

**Architecture reference (Credential Storage pattern):**
```
User enters password
    → credentialStore.encrypt(password)
    → store encrypted string in config file
    → on reconnect: credentialStore.decrypt(encrypted)
    → use decrypted password for Basic Auth header
```

When Epic 11 adds Electron, a `SafeStorageCredentialStore` can be created that uses `safeStorage.encryptString()` / `safeStorage.decryptString()`. The `ICredentialStore` interface makes this swap trivial.

### Important Design Decisions

1. **ICredentialStore abstraction**: Rather than directly calling `safeStorage`, ConnectionManager depends on the `ICredentialStore` interface. This enables:
   - Unit testing without Electron
   - Bridge implementation using Node.js crypto (this story)
   - Future Electron safeStorage implementation (Epic 11)
   - Dependency injection in ConnectionManagerOptions

2. **NodeCryptoCredentialStore**: Uses AES-256-GCM (authenticated encryption) with a key derived from machine-local identifiers (`os.hostname()` + `os.userInfo().username`). This is NOT as secure as OS keychain (safeStorage), but prevents casual plaintext exposure. The encrypted format includes the IV and auth tag for self-contained decryption.

3. **Backward compatibility**: If no `credentialStore` is provided in options, ConnectionManager behaves exactly as before (plaintext passthrough). This preserves all existing tests.

4. **Password-not-persisted fallback**: If `credentialStore.isAvailable()` returns false, passwords are stored as empty strings on disk. The user gets a `credentialWarning` event and must re-enter passwords each session.

5. **getServers() strips passwords**: Per architecture, `getServers()` returns server info for display without passwords. The `getDecryptedPassword()` method provides the password separately when needed for connection.

### Previous Story Intelligence (12.3)

**Story 12.3 established:**
- `ConnectionManager.testConnection(config)` uses password directly from form (not stored)
- `TestConnectionConfig` interface includes `password: string` (plaintext)
- 47 test connection tests
- 375 total tests (241 vscode + 134 desktop)

**ConnectionManager current state:**
- `ServerConfig.encryptedPassword: string` field (currently plaintext despite the name)
- `saveServer()`, `updateServer()`, `deleteServer()`, `getServer()`, `getServers()`, `getServerCount()`
- `testConnection()` — uses temporary AtelierApiService, doesn't involve stored passwords
- JSON file persistence with `mode: 0o600`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Credential Storage (Desktop)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.4: Credential Storage]
- [Source: 12-3-test-connection.md — Previous story implementation]
- [Source: packages/desktop/src/main/ConnectionManager.ts — Current implementation]

## Dev Agent Record

### Completion Notes

Implemented credential storage abstraction with AES-256-GCM encryption for the desktop package.

**Key implementation details:**
- `ICredentialStore` interface with `encrypt()`, `decrypt()`, and `isAvailable()` methods
- `NodeCryptoCredentialStore` uses AES-256-GCM with scryptSync key derivation from `os.hostname() + os.userInfo().username` and fixed salt `'iris-table-editor-credential-salt'`
- Storage format: `base64(iv[12] + authTag[16] + ciphertext)` - self-contained for decryption
- `ConnectionManager` refactored with optional `credentialStore` in options:
  - `saveServer()`: encrypts password before disk write
  - `getServer()`: decrypts password in returned copy
  - `getServers()`: strips passwords (returns empty string) when credential store is present
  - `updateServer()`: encrypts new password or preserves existing encrypted value on empty string
  - `getDecryptedPassword()`: convenience method for connection flow
  - `testConnection()`: unchanged (uses form password directly)
- Full backward compatibility: no credential store = plaintext passthrough (all 41 existing ConnectionManager tests + 47 testConnection tests unaffected)
- `IDesktopCredentialWarningPayload` and `credentialWarning` event added to `DesktopConnectionEvent` in core

**Test results:**
- 184 desktop tests pass (50 new credential tests + 134 existing)
- 241 VS Code extension tests pass (unchanged)
- 0 failures across all workspaces
- Compile: clean
- Lint: clean
- No `vscode` imports in desktop package

### Files Changed

- `packages/desktop/src/main/ICredentialStore.ts` (new) — ICredentialStore interface
- `packages/desktop/src/main/NodeCryptoCredentialStore.ts` (new) — AES-256-GCM Node.js crypto implementation
- `packages/desktop/src/main/ConnectionManager.ts` (modified) — Added credentialStore integration, getDecryptedPassword(), encrypt/decrypt in CRUD
- `packages/desktop/src/index.ts` (modified) — Added ICredentialStore and NodeCryptoCredentialStore exports
- `packages/desktop/src/test/credentialStore.test.ts` (new) — 50 tests for credential storage
- `packages/core/src/models/IMessages.ts` (modified) — Added IDesktopCredentialWarningPayload and credentialWarning event
- `packages/core/src/index.ts` (modified) — Added IDesktopCredentialWarningPayload export
