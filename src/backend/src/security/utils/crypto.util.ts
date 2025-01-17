import { encrypt, decrypt } from '../../common/utils/encryption.util';
import * as bcrypt from 'bcrypt'; // v5.1.0
import * as crypto from 'crypto';

// Constants for cryptographic operations
const SALT_ROUNDS = 12;
const TOKEN_BYTES = 32;

// Error messages
const ERROR_MESSAGES = {
  INVALID_PASSWORD: 'Invalid password input',
  INVALID_HASH: 'Invalid hash input',
  INVALID_DATA: 'Invalid data input',
  HASH_FAILED: 'Password hashing failed',
  COMPARE_FAILED: 'Password comparison failed',
  TOKEN_FAILED: 'Token generation failed',
  DATA_HASH_FAILED: 'Data hashing failed'
} as const;

/**
 * Securely hashes a plain text password using bcrypt with configurable salt rounds
 * @param {string} password - Plain text password to hash
 * @returns {Promise<string>} Hashed password string
 * @throws {Error} If password is invalid or hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Validate input
    if (!password || typeof password !== 'string') {
      throw new Error(ERROR_MESSAGES.INVALID_PASSWORD);
    }

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Verify hash was generated correctly
    if (!hashedPassword) {
      throw new Error(ERROR_MESSAGES.HASH_FAILED);
    }

    return hashedPassword;
  } catch (error) {
    // Avoid leaking internal errors
    throw new Error(ERROR_MESSAGES.HASH_FAILED);
  } finally {
    // Clear sensitive data from memory
    if (password) {
      password = '';
    }
  }
}

/**
 * Securely compares a plain text password with a hashed password using timing-safe comparison
 * @param {string} plainPassword - Plain text password to compare
 * @param {string} hashedPassword - Bcrypt hashed password to compare against
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 * @throws {Error} If inputs are invalid or comparison fails
 */
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    // Validate inputs
    if (!plainPassword || !hashedPassword) {
      throw new Error(ERROR_MESSAGES.INVALID_PASSWORD);
    }

    // Perform timing-safe comparison
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    return isMatch;
  } catch (error) {
    throw new Error(ERROR_MESSAGES.COMPARE_FAILED);
  } finally {
    // Clear sensitive data from memory
    if (plainPassword) {
      plainPassword = '';
    }
  }
}

/**
 * Generates a cryptographically secure random token
 * @returns {string} Base64 encoded random token
 * @throws {Error} If token generation fails
 */
export function generateSecureToken(): string {
  try {
    // Generate random bytes
    const randomBytes = crypto.randomBytes(TOKEN_BYTES);

    // Convert to URL-safe base64
    const token = randomBytes
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return token;
  } catch (error) {
    throw new Error(ERROR_MESSAGES.TOKEN_FAILED);
  }
}

/**
 * Creates a SHA-256 hash of provided data with secure memory handling
 * @param {string} data - Data to hash
 * @returns {string} Hex encoded SHA-256 hash string
 * @throws {Error} If data is invalid or hashing fails
 */
export function hashData(data: string): string {
  try {
    // Validate input
    if (!data || typeof data !== 'string') {
      throw new Error(ERROR_MESSAGES.INVALID_DATA);
    }

    // Create hash instance
    const hash = crypto.createHash('sha256');
    
    // Update hash with data and generate digest
    hash.update(data, 'utf8');
    const hashedData = hash.digest('hex');

    // Verify hash was generated
    if (!hashedData) {
      throw new Error(ERROR_MESSAGES.DATA_HASH_FAILED);
    }

    return hashedData;
  } catch (error) {
    throw new Error(ERROR_MESSAGES.DATA_HASH_FAILED);
  } finally {
    // Clear sensitive data from memory
    if (data) {
      data = '';
    }
  }
}