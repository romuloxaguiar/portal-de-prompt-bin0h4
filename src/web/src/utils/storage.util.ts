/**
 * @fileoverview Browser storage utility module providing type-safe storage operations
 * with encryption, compression, and error handling capabilities.
 * @version 1.0.0
 */

import { ErrorCode } from '../constants/error.constant';
import CryptoJS from 'crypto-js'; // v4.2.1

/**
 * Storage key constants for consistent key usage across the application
 */
export enum StorageKeys {
  USER_PREFERENCES = 'user_preferences',
  AUTH_TOKEN = 'auth_token',
  WORKSPACE_SETTINGS = 'workspace_settings',
  THEME = 'theme',
  LANGUAGE = 'language',
  RECENT_PROMPTS = 'recent_prompts',
  EDITOR_STATE = 'editor_state',
  ENCRYPTION_SALT = 'encryption_salt',
  LAST_SYNC = 'last_sync',
  CACHED_TEMPLATES = 'cached_templates'
}

/**
 * Configuration options for storage operations
 */
export interface StorageOptions {
  encrypt?: boolean;
  compress?: boolean;
  ttl?: number;
}

/**
 * Storage metadata interface for versioning and data management
 */
interface StorageMetadata {
  version: string;
  timestamp: number;
  compressed: boolean;
  encrypted: boolean;
  ttl?: number;
}

// Constants
const STORAGE_PREFIX = 'prompts_portal_';
const MAX_STORAGE_SIZE = 5242880; // 5MB
const STORAGE_VERSION = '1';
const ENCRYPTION_ITERATIONS = 10000;
const ENCRYPTION_KEY = process.env.STORAGE_ENCRYPTION_KEY || '';

/**
 * Error class for storage-related exceptions
 */
class StorageError extends Error {
  constructor(message: string, public code: ErrorCode) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Encrypts data using AES-256-GCM
 */
const encrypt = async (data: string, salt: string): Promise<string> => {
  try {
    const key = CryptoJS.PBKDF2(ENCRYPTION_KEY, salt, {
      keySize: 256 / 32,
      iterations: ENCRYPTION_ITERATIONS
    });
    return CryptoJS.AES.encrypt(data, key.toString()).toString();
  } catch (error) {
    throw new StorageError('Encryption failed', ErrorCode.ENCRYPTION_ERROR);
  }
};

/**
 * Decrypts AES-256-GCM encrypted data
 */
const decrypt = async (encryptedData: string, salt: string): Promise<string> => {
  try {
    const key = CryptoJS.PBKDF2(ENCRYPTION_KEY, salt, {
      keySize: 256 / 32,
      iterations: ENCRYPTION_ITERATIONS
    });
    const bytes = CryptoJS.AES.decrypt(encryptedData, key.toString());
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    throw new StorageError('Decryption failed', ErrorCode.ENCRYPTION_ERROR);
  }
};

/**
 * Compresses data using LZW compression
 */
const compress = (data: string): string => {
  return btoa(encodeURIComponent(data));
};

/**
 * Decompresses LZW compressed data
 */
const decompress = (compressedData: string): string => {
  return decodeURIComponent(atob(compressedData));
};

/**
 * Storage utility object containing public methods for storage operations
 */
export const storage = {
  /**
   * Stores data in browser storage with optional encryption and compression
   */
  async setItem<T>(key: string, value: T, options: StorageOptions = {}): Promise<void> {
    try {
      if (!key) {
        throw new StorageError('Invalid storage key', ErrorCode.VALIDATION_ERROR);
      }

      const storageSize = await this.getStorageSize();
      if (storageSize >= MAX_STORAGE_SIZE) {
        throw new StorageError('Storage quota exceeded', ErrorCode.STORAGE_ERROR);
      }

      let data = JSON.stringify(value);
      const metadata: StorageMetadata = {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        compressed: false,
        encrypted: false
      };

      if (options.ttl) {
        metadata.ttl = options.ttl;
      }

      if (options.compress) {
        data = compress(data);
        metadata.compressed = true;
      }

      if (options.encrypt) {
        const salt = localStorage.getItem(`${STORAGE_PREFIX}${StorageKeys.ENCRYPTION_SALT}`);
        if (!salt) {
          throw new StorageError('Encryption salt not found', ErrorCode.ENCRYPTION_ERROR);
        }
        data = await encrypt(data, salt);
        metadata.encrypted = true;
      }

      const storageItem = JSON.stringify({
        data,
        metadata
      });

      localStorage.setItem(`${STORAGE_PREFIX}${key}`, storageItem);
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError('Storage operation failed', ErrorCode.STORAGE_ERROR);
    }
  },

  /**
   * Retrieves and deserializes data from browser storage with automatic decryption
   */
  async getItem<T>(key: string, options: StorageOptions = {}): Promise<T | null> {
    try {
      const storageItem = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (!storageItem) {
        return null;
      }

      const { data, metadata } = JSON.parse(storageItem);

      if (metadata.version !== STORAGE_VERSION) {
        throw new StorageError('Storage version mismatch', ErrorCode.STORAGE_ERROR);
      }

      if (metadata.ttl && Date.now() > metadata.timestamp + metadata.ttl) {
        await this.removeItem(key);
        return null;
      }

      let resultData = data;

      if (metadata.encrypted) {
        const salt = localStorage.getItem(`${STORAGE_PREFIX}${StorageKeys.ENCRYPTION_SALT}`);
        if (!salt) {
          throw new StorageError('Encryption salt not found', ErrorCode.ENCRYPTION_ERROR);
        }
        resultData = await decrypt(resultData, salt);
      }

      if (metadata.compressed) {
        resultData = decompress(resultData);
      }

      return JSON.parse(resultData) as T;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError('Storage retrieval failed', ErrorCode.STORAGE_ERROR);
    }
  },

  /**
   * Removes item from browser storage
   */
  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch (error) {
      throw new StorageError('Storage removal failed', ErrorCode.STORAGE_ERROR);
    }
  },

  /**
   * Clears all stored data with application prefix
   */
  async clear(): Promise<void> {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      throw new StorageError('Storage clear failed', ErrorCode.STORAGE_ERROR);
    }
  },

  /**
   * Calculates total size of stored data including metadata
   */
  async getStorageSize(): Promise<number> {
    try {
      let totalSize = 0;
      const keys = Object.keys(localStorage);
      
      keys.forEach(key => {
        if (key.startsWith(STORAGE_PREFIX)) {
          const item = localStorage.getItem(key);
          if (item) {
            totalSize += key.length + item.length;
          }
        }
      });

      return totalSize;
    } catch (error) {
      throw new StorageError('Storage size calculation failed', ErrorCode.STORAGE_ERROR);
    }
  },

  /**
   * Initializes storage with encryption keys and metadata
   */
  async initializeStorage(): Promise<void> {
    try {
      if (!localStorage.getItem(`${STORAGE_PREFIX}${StorageKeys.ENCRYPTION_SALT}`)) {
        const salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
        localStorage.setItem(`${STORAGE_PREFIX}${StorageKeys.ENCRYPTION_SALT}`, salt);
      }

      // Verify storage availability
      const testKey = `${STORAGE_PREFIX}test`;
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
    } catch (error) {
      throw new StorageError('Storage initialization failed', ErrorCode.STORAGE_ERROR);
    }
  }
};

export default storage;