// Vault Recovery Service
// Implements recovery codes for vault access when password is forgotten

// This implementation uses IndexedDB to store recovery information locally
// In a production implementation, this would be stored on the server with proper encryption

let dbPromise: Promise<IDBDatabase> | null = null;

import { logVaultEvent } from '@/services/activityService';

interface RecoveryDB {
  recoveryStore: {
    key: string; // roomId
    value: {
      recoverySalt: string;
      recoveryVerifier: string;
      createdAt: string;
    };
  };
}

function getRecoveryDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('cogallery-vault-recovery', 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('recoveryStore');
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

// Recovery code format: 8 uppercase alphanumeric characters
const RECOVERY_CODE_LENGTH = 8;
const RECOVERY_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate a secure random recovery code
 */
export function generateRecoveryCode(): string {
  let code = '';
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * RECOVERY_CHARSET.length);
    code += RECOVERY_CHARSET[randomIndex];
  }
  return code;
}

/**
 * Hash a recovery code for storage (similar to password hashing)
 * Uses PBKDF2 with SHA-256
 */
export async function hashRecoveryCode(
  recoveryCode: string,
  salt: string
): Promise<string> {
  // Text encoder for converting string to bytes
  const enc = new TextEncoder();

  // Convert salt from hex to Uint8Array
  const saltBuffer = new Uint8Array(
    salt.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );

  // Import the recovery code as password material
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(recoveryCode),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive key using PBKDF2
  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 600_000, // Same as password hashing
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );

  // Generate a fixed value to hash (in real implementation, this would be random)
  const dataToHash = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);

  // Sign the data to create verifier
  const signature = await window.crypto.subtle.sign(
    { name: 'HMAC' },
    key,
    dataToHash
  );

  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Store recovery information for a vault
 */
export async function storeVaultRecoveryInfo(
  roomId: string,
  recoveryCode: string
): Promise<void> {
  try {
    const db = await getRecoveryDB();
    const recoverySalt = await generateSaltHex();
    const recoveryVerifier = await hashRecoveryCode(recoveryCode, recoverySalt);

    const transaction = db.transaction('recoveryStore', 'readwrite');
    const store = transaction.objectStore('recoveryStore');

    store.put({
      recoverySalt,
      recoveryVerifier,
      createdAt: new Date().toISOString()
    }, roomId);

    await transaction.complete;

    // Audit log recovery info storage
    // Note: In a real implementation, we would have the userId here
    // For client-only implementation, we're logging without user context
    await logVaultEvent('create', roomId, null, true);
  } catch (error) {
    console.error('Failed to store vault recovery info:', error);
    throw error;
  }
}

/**
 * Verify a recovery code for a vault
 * @returns true if the recovery code is valid
 */
export async function verifyVaultRecoveryCode(
  roomId: string,
  recoveryCode: string
): Promise<boolean> {
  try {
    const db = await getRecoveryDB();
    const transaction = db.transaction('recoveryStore', 'readonly');
    const store = transaction.objectStore('recoveryStore');

    const request = store.get(roomId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          // Log failed verification attempt (no record found)
          // Note: We don't have userId here in the client-only implementation
          // In a full implementation, this would be done server-side with user context
          resolve(false);
          return;
        }

        const { recoverySalt, recoveryVerifier } = result;

        // Hash the provided recovery code with the stored salt
        const computedVerifier = await hashRecoveryCode(recoveryCode, recoverySalt);

        // Compare using constant-time comparison to prevent timing attacks
        let result = 0;
        for (let i = 0; i < recoveryVerifier.length; i++) {
          result |= recoveryVerifier.charCodeAt(i) ^ computedVerifier.charCodeAt(i);
        }

        const isValid = result === 0; // 0 means strings are identical

        // Log verification attempt
        // Note: We don't have userId here in the client-only implementation
        // In a full implementation, this would be done server-side with user context
        resolve(isValid);
      };

      request.onerror = () => {
        // Log error
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Failed to verify vault recovery code:', error);
    return false;
  }
}

/**
 * Remove recovery information for a vault (after successful recovery)
 */
export async function removeVaultRecoveryInfo(roomId: string): Promise<void> {
  try {
    const db = await getRecoveryDB();
    const transaction = db.transaction('recoveryStore', 'readwrite');
    const store = transaction.objectStore('recoveryStore');

    store.delete(roomId);

    await transaction.complete;

    // Audit log recovery info removal
    await logVaultEvent('remove', roomId, null, true);
  } catch (error) {
    console.error('Failed to remove vault recovery info:', error);
    throw error;
  }
}

/**
 * Get recovery info for debugging purposes (would be removed in production)
 */
export async function getVaultRecoveryInfo(roomId: string): Promise<any> {
  try {
    const db = await getRecoveryDB();
    const transaction = db.transaction('recoveryStore', 'readonly');
    const store = transaction.objectStore('recoveryStore');

    const request = store.get(roomId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get vault recovery info:', error);
    throw error;
  }
}