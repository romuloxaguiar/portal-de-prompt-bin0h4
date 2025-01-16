import { randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'crypto';

// Constants for encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM authentication tag
const IV_LENGTH = 12; // 12 bytes for GCM IV
const KEY_LENGTH = 32; // 32 bytes (256 bits) for AES-256
const ENCODING = 'utf8';

// Error messages for secure error handling
const ERROR_MESSAGES = {
  INVALID_KEY: 'Invalid encryption key length',
  INVALID_IV: 'Invalid initialization vector',
  INVALID_TAG: 'Invalid authentication tag',
  DECRYPTION_FAILED: 'Decryption failed - data may be corrupted',
  INVALID_INPUT: 'Invalid input data'
} as const;

/**
 * Generates a cryptographically secure encryption key for AES-256-GCM
 * @returns {Buffer} 32-byte encryption key
 * @throws {Error} If key generation fails
 */
export function generateKey(): Buffer {
  try {
    const key = randomBytes(KEY_LENGTH);
    
    // Validate entropy of generated key
    if (key.length !== KEY_LENGTH) {
      throw new Error(ERROR_MESSAGES.INVALID_KEY);
    }
    
    return key;
  } catch (error) {
    // Rethrow with generic message to avoid leaking implementation details
    throw new Error('Key generation failed');
  }
}

/**
 * Generates a cryptographically secure initialization vector
 * @returns {Buffer} 12-byte IV buffer
 * @throws {Error} If IV generation fails
 */
export function generateIV(): Buffer {
  try {
    const iv = randomBytes(IV_LENGTH);
    
    if (iv.length !== IV_LENGTH) {
      throw new Error(ERROR_MESSAGES.INVALID_IV);
    }
    
    return iv;
  } catch (error) {
    throw new Error('IV generation failed');
  }
}

/**
 * Encrypts data using AES-256-GCM with authentication
 * @param {Buffer | string} data - Data to encrypt
 * @param {Buffer} key - 32-byte encryption key
 * @returns {Object} Object containing encrypted data, IV, and authentication tag
 * @throws {Error} If encryption fails
 */
export function encrypt(data: Buffer | string, key: Buffer): { 
  encrypted: Buffer; 
  iv: Buffer; 
  tag: Buffer; 
} {
  try {
    // Input validation
    if (!data || !key || key.length !== KEY_LENGTH) {
      throw new Error(ERROR_MESSAGES.INVALID_INPUT);
    }

    // Convert string input to buffer if needed
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, ENCODING);
    
    // Generate IV for this encryption operation
    const iv = generateIV();
    
    // Create cipher instance
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    // Pre-allocate buffer for better performance
    const encrypted = Buffer.concat([
      cipher.update(dataBuffer),
      cipher.final()
    ]);

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Clean up sensitive data
    dataBuffer.fill(0);
    
    return { encrypted, iv, tag };
  } catch (error) {
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypts data using AES-256-GCM with authentication verification
 * @param {Buffer} encryptedData - Data to decrypt
 * @param {Buffer} key - 32-byte encryption key
 * @param {Buffer} iv - 12-byte initialization vector
 * @param {Buffer} authTag - 16-byte authentication tag
 * @returns {Buffer} Decrypted data
 * @throws {Error} If decryption or authentication fails
 */
export function decrypt(
  encryptedData: Buffer,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer
): Buffer {
  try {
    // Input validation
    if (!encryptedData || !key || !iv || !authTag) {
      throw new Error(ERROR_MESSAGES.INVALID_INPUT);
    }
    
    if (key.length !== KEY_LENGTH) throw new Error(ERROR_MESSAGES.INVALID_KEY);
    if (iv.length !== IV_LENGTH) throw new Error(ERROR_MESSAGES.INVALID_IV);
    if (authTag.length !== AUTH_TAG_LENGTH) throw new Error(ERROR_MESSAGES.INVALID_TAG);

    // Create decipher instance
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);

    return decrypted;
  } catch (error) {
    // Handle authentication failure separately
    if (error.message.includes('auth')) {
      throw new Error(ERROR_MESSAGES.DECRYPTION_FAILED);
    }
    throw new Error('Decryption failed');
  }
}

/**
 * Encrypts a single field value with encoding and serialization
 * @param {any} value - Value to encrypt
 * @param {Buffer} key - 32-byte encryption key
 * @returns {string} Base64 encoded encrypted value
 * @throws {Error} If encryption fails
 */
export function encryptField(value: any, key: Buffer): string {
  try {
    // Serialize non-string values
    const serializedValue = typeof value === 'string' 
      ? value 
      : JSON.stringify(value);

    // Encrypt the serialized value
    const { encrypted, iv, tag } = encrypt(serializedValue, key);

    // Combine components efficiently
    const combined = Buffer.concat([
      iv,
      tag,
      encrypted
    ]);

    // Return base64 encoded result
    return combined.toString('base64');
  } catch (error) {
    throw new Error('Field encryption failed');
  }
}

/**
 * Decrypts a single encrypted field value with decoding and deserialization
 * @param {string} encryptedValue - Base64 encoded encrypted value
 * @param {Buffer} key - 32-byte encryption key
 * @returns {string} Decrypted value
 * @throws {Error} If decryption fails
 */
export function decryptField(encryptedValue: string, key: Buffer): string {
  try {
    // Decode base64 input
    const combined = Buffer.from(encryptedValue, 'base64');

    // Extract components
    const iv = combined.slice(0, IV_LENGTH);
    const tag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);

    // Decrypt the value
    const decrypted = decrypt(encrypted, key, iv, tag);
    
    // Return decrypted string
    return decrypted.toString(ENCODING);
  } catch (error) {
    throw new Error('Field decryption failed');
  }
}