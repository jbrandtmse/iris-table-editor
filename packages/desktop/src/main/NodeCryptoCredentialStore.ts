/**
 * NodeCryptoCredentialStore - Node.js crypto-based credential encryption
 * Story 12.4: Credential Storage
 *
 * Bridge implementation using AES-256-GCM authenticated encryption.
 * Key is derived from machine-local identifiers (hostname + username).
 *
 * This is NOT as secure as OS keychain (Electron safeStorage), but prevents
 * casual plaintext exposure in config files. Will be replaced by
 * SafeStorageCredentialStore when Electron is added in Epic 11.
 *
 * Storage format: base64(iv + authTag + ciphertext)
 *   - IV: 12 bytes (AES-GCM standard)
 *   - Auth Tag: 16 bytes (GCM authentication tag)
 *   - Ciphertext: variable length
 */
import * as crypto from 'crypto';
import * as os from 'os';
import type { ICredentialStore } from './ICredentialStore';

const LOG_PREFIX = '[IRIS-TE]';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT = 'iris-table-editor-credential-salt';

/**
 * AES-256-GCM credential store using Node.js crypto module.
 * Encrypts passwords with a key derived from machine-local identifiers.
 */
export class NodeCryptoCredentialStore implements ICredentialStore {
    private readonly key: Buffer;

    constructor() {
        const machineKey = this.deriveMachineKey();
        this.key = crypto.scryptSync(machineKey, SALT, KEY_LENGTH);
    }

    /**
     * Encrypt a plaintext password using AES-256-GCM.
     * @param password - Plaintext password to encrypt
     * @returns Base64-encoded string containing IV + AuthTag + Ciphertext
     */
    encrypt(password: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

        const encrypted = Buffer.concat([
            cipher.update(password, 'utf8'),
            cipher.final(),
        ]);

        const authTag = cipher.getAuthTag();

        // Format: iv (12) + authTag (16) + ciphertext (variable)
        const combined = Buffer.concat([iv, authTag, encrypted]);
        return combined.toString('base64');
    }

    /**
     * Decrypt an encrypted password string.
     * @param encrypted - Base64-encoded string from encrypt()
     * @returns Plaintext password
     * @throws Error if decryption fails (wrong key, corrupted data, tampered)
     */
    decrypt(encrypted: string): string {
        const combined = Buffer.from(encrypted, 'base64');

        if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
            throw new Error('Invalid encrypted data: too short');
        }

        const iv = combined.subarray(0, IV_LENGTH);
        const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
        decipher.setAuthTag(authTag);

        try {
            const decrypted = Buffer.concat([
                decipher.update(ciphertext),
                decipher.final(),
            ]);
            return decrypted.toString('utf8');
        } catch (error) {
            throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Node.js crypto is always available.
     * @returns true
     */
    isAvailable(): boolean {
        return true;
    }

    /**
     * Derive a machine-local key from hostname and OS username.
     * This binds encrypted data to the current machine/user context.
     */
    private deriveMachineKey(): string {
        try {
            const hostname = os.hostname();
            const userInfo = os.userInfo();
            const machineKey = hostname + userInfo.username;
            console.log(`${LOG_PREFIX} Credential store initialized with machine-local key`);
            return machineKey;
        } catch (error) {
            // Fallback if os.userInfo() fails (e.g., no user database)
            console.warn(`${LOG_PREFIX} Failed to get user info, using hostname only: ${error}`);
            return os.hostname();
        }
    }
}
