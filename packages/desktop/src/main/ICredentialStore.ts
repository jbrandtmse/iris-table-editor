/**
 * ICredentialStore - Abstraction for credential encryption/decryption
 * Story 12.4: Credential Storage
 *
 * Provides a pluggable interface for encrypting and decrypting passwords.
 * Implementations:
 * - NodeCryptoCredentialStore: Bridge implementation using Node.js crypto (this story)
 * - SafeStorageCredentialStore: Future Electron safeStorage implementation (Epic 11)
 */

/**
 * Interface for credential encryption and decryption.
 * ConnectionManager uses this to encrypt passwords before disk storage
 * and decrypt them when needed for authentication.
 */
export interface ICredentialStore {
    /**
     * Encrypt a plaintext password for storage.
     * @param password - Plaintext password to encrypt
     * @returns Base64-encoded encrypted string
     */
    encrypt(password: string): string;

    /**
     * Decrypt an encrypted password string.
     * @param encrypted - Base64-encoded encrypted string from encrypt()
     * @returns Plaintext password
     * @throws Error if decryption fails (wrong key, corrupted data, etc.)
     */
    decrypt(encrypted: string): string;

    /**
     * Check whether encryption is available on this system.
     * @returns true if encrypt/decrypt operations will work
     */
    isAvailable(): boolean;
}
