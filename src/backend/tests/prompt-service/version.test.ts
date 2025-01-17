/**
 * @fileoverview Comprehensive test suite for version control functionality in the Prompts Portal
 * Tests version creation, retrieval, comparison, and management operations with extensive validation
 * @version 1.0.0
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { VersionService } from '../../src/prompt-service/services/version.service';
import { IVersion, IVersionChanges } from '../../src/prompt-service/interfaces/version.interface';
import Version from '../../src/prompt-service/models/version.model';
import { v4 as uuidv4 } from 'uuid';

// Test configuration
const testConfig = {
  maxVersionRetention: 10,
  validation: {
    maxContentLength: 10000,
    allowedCharacters: /^[a-zA-Z0-9\s\{\}\[\].,!?-]*$/
  }
};

// Global test variables
let mongoServer: MongoMemoryServer;
let versionService: VersionService;
let mockPromptId: string;
let mockUserId: string;

// Mock version data
const createMockVersion = (content: string = 'Test prompt content'): Partial<IVersion> => ({
  promptId: mockPromptId,
  content,
  createdBy: mockUserId,
  createdAt: new Date()
});

describe('VersionService', () => {
  beforeAll(async () => {
    // Initialize MongoDB memory server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Initialize version service
    versionService = new VersionService(Version, testConfig.maxVersionRetention);

    // Generate test IDs
    mockPromptId = uuidv4();
    mockUserId = uuidv4();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Version.deleteMany({});
  });

  describe('createVersion', () => {
    test('should create a new version with valid data', async () => {
      const versionData = createMockVersion();
      const result = await versionService.createVersion(versionData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.promptId).toBe(mockPromptId);
        expect(result.data.versionNumber).toBe(1);
        expect(result.data.content).toBe(versionData.content);
      }
    });

    test('should reject version creation with invalid content', async () => {
      const versionData = createMockVersion('<script>alert("xss")</script>');
      const result = await versionService.createVersion(versionData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PROMPT_VALIDATION_ERROR');
      }
    });

    test('should auto-increment version numbers', async () => {
      const version1 = await versionService.createVersion(createMockVersion());
      const version2 = await versionService.createVersion(createMockVersion());

      expect(version1.success && version2.success).toBe(true);
      if (version1.success && version2.success) {
        expect(version2.data.versionNumber).toBe(version1.data.versionNumber + 1);
      }
    });

    test('should track changes between versions', async () => {
      const version1 = await versionService.createVersion(createMockVersion('Initial content'));
      const version2 = await versionService.createVersion(createMockVersion('Modified content'));

      expect(version2.success).toBe(true);
      if (version2.success) {
        expect(version2.data.changes.addedContent.length).toBeGreaterThan(0);
        expect(version2.data.changes.removedContent.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getVersionHistory', () => {
    test('should retrieve paginated version history', async () => {
      // Create multiple versions
      for (let i = 0; i < 5; i++) {
        await versionService.createVersion(createMockVersion(`Content ${i}`));
      }

      const result = await versionService.getVersionHistory(mockPromptId, { page: 1, limit: 3 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.versions.length).toBe(3);
        expect(result.data.total).toBe(5);
        expect(result.data.totalPages).toBe(2);
      }
    });

    test('should return empty history for non-existent prompt', async () => {
      const result = await versionService.getVersionHistory(uuidv4(), { page: 1, limit: 10 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.versions.length).toBe(0);
        expect(result.data.total).toBe(0);
      }
    });
  });

  describe('compareVersions', () => {
    test('should compare two versions and identify changes', async () => {
      const version1 = await versionService.createVersion(createMockVersion('Initial {var1}'));
      const version2 = await versionService.createVersion(createMockVersion('Modified {var2}'));

      if (version1.success && version2.success) {
        const comparison = await versionService.compareVersions(
          version1.data.id,
          version2.data.id
        );

        expect(comparison.success).toBe(true);
        if (comparison.success) {
          expect(comparison.data.additions.length).toBeGreaterThan(0);
          expect(comparison.data.deletions.length).toBeGreaterThan(0);
          expect(comparison.data.modifications).toBeDefined();
        }
      }
    });

    test('should handle comparison of non-existent versions', async () => {
      const result = await versionService.compareVersions(uuidv4(), uuidv4());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND_ERROR');
      }
    });
  });

  describe('revertToVersion', () => {
    test('should create new version based on previous version', async () => {
      const version1 = await versionService.createVersion(createMockVersion('Initial content'));
      const version2 = await versionService.createVersion(createMockVersion('Modified content'));

      if (version1.success && version2.success) {
        const revertResult = await versionService.revertToVersion(
          mockPromptId,
          version1.data.id
        );

        expect(revertResult.success).toBe(true);
        if (revertResult.success) {
          expect(revertResult.data.content).toBe('Initial content');
          expect(revertResult.data.versionNumber).toBe(3);
        }
      }
    });

    test('should handle reversion to invalid version', async () => {
      const result = await versionService.revertToVersion(mockPromptId, uuidv4());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND_ERROR');
      }
    });
  });

  describe('version retention', () => {
    test('should enforce maximum version retention limit', async () => {
      // Create versions beyond retention limit
      for (let i = 0; i < testConfig.maxVersionRetention + 5; i++) {
        await versionService.createVersion(createMockVersion(`Content ${i}`));
      }

      const history = await versionService.getVersionHistory(mockPromptId, { page: 1, limit: 100 });

      expect(history.success).toBe(true);
      if (history.success) {
        expect(history.data.total).toBe(testConfig.maxVersionRetention);
      }
    });
  });

  describe('error handling', () => {
    test('should handle database connection errors gracefully', async () => {
      await mongoose.disconnect();

      const result = await versionService.createVersion(createMockVersion());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_SERVER_ERROR');
      }

      // Reconnect for subsequent tests
      await mongoose.connect(mongoServer.getUri());
    });

    test('should validate version data thoroughly', async () => {
      const invalidVersion = {
        promptId: 'invalid-uuid',
        content: '',
        createdBy: ''
      };

      const result = await versionService.createVersion(invalidVersion);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });
});