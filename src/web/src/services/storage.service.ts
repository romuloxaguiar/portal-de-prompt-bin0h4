/**
 * @fileoverview Enterprise-grade storage service providing secure, type-safe storage operations
 * with encryption, compression, and cross-tab synchronization for the Prompts Portal frontend.
 * @version 1.0.0
 */

import { StorageKeys, setItem, getItem, removeItem } from '../utils/storage.util';
import { IAuthTokens } from '../interfaces/auth.interface';
import { ErrorCode } from '../utils/error.util';
import LZString from 'lz-string'; // v1.5.0
import CryptoJS from 'crypto-js'; // v4.1.1

/**
 * Interface for storage event payload with type safety
 */
interface StorageEventPayload<T> {
  key: string;
  value: T;
  timestamp: number;
  source: string;
}

/**
 * Storage service providing high-level storage operations with enterprise features
 */
export class StorageService {
  private static instance: StorageService;
  private readonly storageVersion: string = '1.0.0';
  private readonly maxStorageSize: number = 5 * 1024 * 1024; // 5MB
  private readonly cleanupInterval: number = 1800000; // 30 minutes
  private readonly sessionId: string = crypto.randomUUID();

  private constructor() {
    this.initializeStorage();
    this.setupStorageEventListeners();
    this.startCleanupInterval();
  }

  /**
   * Gets singleton instance of StorageService
   */
  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Initializes storage with required metadata and encryption keys
   */
  private async initializeStorage(): Promise<void> {
    try {
      // Verify storage availability
      if (!this.isStorageAvailable()) {
        throw new Error('Local storage is not available');
      }

      // Initialize encryption salt if not exists
      if (!await getItem('encryption_salt')) {
        const salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
        await setItem('encryption_salt', salt);
      }

      // Set storage version
      await setItem('storage_version', this.storageVersion);

      // Initialize last sync timestamp
      await setItem(StorageKeys.LAST_SYNC, Date.now());
    } catch (error) {
      console.error('Storage initialization failed:', error);
      throw new Error('Storage initialization failed');
    }
  }

  /**
   * Saves authentication tokens with encryption and compression
   */
  public async saveAuthTokens(tokens: IAuthTokens): Promise<void> {
    try {
      if (!tokens.accessToken || !tokens.refreshToken) {
        throw new Error('Invalid token data');
      }

      const encryptedTokens = await this.encryptData(JSON.stringify(tokens));
      const compressedTokens = this.compressData(encryptedTokens);

      await setItem(StorageKeys.AUTH_TOKEN, compressedTokens, {
        ttl: 3600000, // 1 hour
        encrypted: true,
        compressed: true
      });

      this.broadcastStorageUpdate(StorageKeys.AUTH_TOKEN, tokens);
    } catch (error) {
      console.error('Token storage failed:', error);
      throw new Error('Failed to save authentication tokens');
    }
  }

  /**
   * Retrieves and decrypts authentication tokens
   */
  public async getAuthTokens(): Promise<IAuthTokens | null> {
    try {
      const compressedTokens = await getItem<string>(StorageKeys.AUTH_TOKEN);
      if (!compressedTokens) {
        return null;
      }

      const encryptedTokens = this.decompressData(compressedTokens);
      const tokensString = await this.decryptData(encryptedTokens);
      
      return JSON.parse(tokensString) as IAuthTokens;
    } catch (error) {
      console.error('Token retrieval failed:', error);
      return null;
    }
  }

  /**
   * Monitors storage quota and triggers cleanup if needed
   */
  public async monitorStorageQuota(): Promise<void> {
    try {
      const currentSize = await this.calculateStorageSize();
      const quotaPercentage = (currentSize / this.maxStorageSize) * 100;

      if (quotaPercentage > 90) {
        await this.cleanupStorage();
      }

      if (quotaPercentage > 80) {
        this.emitQuotaWarning(quotaPercentage);
      }
    } catch (error) {
      console.error('Storage quota monitoring failed:', error);
      throw new Error(ErrorCode.STORAGE_QUOTA_EXCEEDED);
    }
  }

  /**
   * Handles cross-tab storage synchronization
   */
  private setupStorageEventListeners(): void {
    window.addEventListener('storage', (event: StorageEvent) => {
      if (!event.key?.startsWith('prompts_portal_')) {
        return;
      }

      const payload = this.parseStorageEvent(event);
      if (payload && payload.source !== this.sessionId) {
        this.handleStorageSync(payload);
      }
    });
  }

  /**
   * Encrypts data using AES-256
   */
  private async encryptData(data: string): Promise<string> {
    const salt = await getItem<string>('encryption_salt');
    if (!salt) {
      throw new Error('Encryption salt not found');
    }

    const key = CryptoJS.PBKDF2(process.env.STORAGE_ENCRYPTION_KEY || '', salt, {
      keySize: 256 / 32,
      iterations: 10000
    });

    return CryptoJS.AES.encrypt(data, key.toString()).toString();
  }

  /**
   * Decrypts AES-256 encrypted data
   */
  private async decryptData(encryptedData: string): Promise<string> {
    const salt = await getItem<string>('encryption_salt');
    if (!salt) {
      throw new Error('Encryption salt not found');
    }

    const key = CryptoJS.PBKDF2(process.env.STORAGE_ENCRYPTION_KEY || '', salt, {
      keySize: 256 / 32,
      iterations: 10000
    });

    const bytes = CryptoJS.AES.decrypt(encryptedData, key.toString());
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Compresses data using LZ-String
   */
  private compressData(data: string): string {
    return LZString.compressToUTF16(data);
  }

  /**
   * Decompresses LZ-String compressed data
   */
  private decompressData(compressedData: string): string {
    return LZString.decompressFromUTF16(compressedData) || '';
  }

  /**
   * Calculates total storage size
   */
  private async calculateStorageSize(): Promise<number> {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('prompts_portal_')) {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += key.length + value.length;
        }
      }
    }
    return totalSize;
  }

  /**
   * Cleans up expired and non-essential data
   */
  private async cleanupStorage(): Promise<void> {
    const nonEssentialKeys = [
      StorageKeys.RECENT_PROMPTS,
      StorageKeys.EDITOR_STATE,
      StorageKeys.CACHED_TEMPLATES
    ];

    for (const key of nonEssentialKeys) {
      await removeItem(key);
    }
  }

  /**
   * Verifies storage availability
   */
  private isStorageAvailable(): boolean {
    try {
      const testKey = 'test_storage';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Emits storage quota warning event
   */
  private emitQuotaWarning(percentage: number): void {
    const event = new CustomEvent('storage-quota-warning', {
      detail: { percentage, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  }

  /**
   * Broadcasts storage updates to other tabs
   */
  private broadcastStorageUpdate<T>(key: string, value: T): void {
    const payload: StorageEventPayload<T> = {
      key,
      value,
      timestamp: Date.now(),
      source: this.sessionId
    };
    localStorage.setItem(`prompts_portal_broadcast`, JSON.stringify(payload));
    localStorage.removeItem(`prompts_portal_broadcast`);
  }

  /**
   * Parses storage event data
   */
  private parseStorageEvent(event: StorageEvent): StorageEventPayload<unknown> | null {
    try {
      return event.newValue ? JSON.parse(event.newValue) : null;
    } catch {
      return null;
    }
  }

  /**
   * Handles storage synchronization between tabs
   */
  private async handleStorageSync<T>(payload: StorageEventPayload<T>): Promise<void> {
    const lastSync = await getItem<number>(StorageKeys.LAST_SYNC) || 0;
    
    if (payload.timestamp > lastSync) {
      await setItem(payload.key, payload.value);
      await setItem(StorageKeys.LAST_SYNC, payload.timestamp);
    }
  }

  /**
   * Starts periodic storage cleanup
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.monitorStorageQuota().catch(console.error);
    }, this.cleanupInterval);
  }
}

export default StorageService.getInstance();