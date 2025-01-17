/**
 * @fileoverview Test suite for validation utility functions
 * @version 1.0.0
 */

import { describe, expect, test, beforeEach } from '@jest/globals';
import { validatePrompt, validateEmail, validateWorkspacePayload, sanitizeInput } from '../../src/utils/validation.util';
import { IPrompt, PromptStatus } from '../../src/interfaces/prompt.interface';
import { WorkspaceCreatePayload, WorkspaceRole } from '../../src/interfaces/workspace.interface';

// Test data setup
const validPromptData: IPrompt = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Valid Test Prompt',
  content: 'This is a valid test prompt content with sufficient length.',
  templateId: null,
  variables: [
    {
      name: 'testVar',
      value: 'test',
      type: 'string',
      description: 'Test variable',
      required: true
    }
  ],
  creatorId: '123e4567-e89b-12d3-a456-426614174001',
  teamId: '123e4567-e89b-12d3-a456-426614174002',
  currentVersion: {
    id: '123e4567-e89b-12d3-a456-426614174003',
    content: 'Test content',
    changes: {
      description: 'Initial version',
      author: 'Test User',
      timestamp: new Date()
    }
  },
  status: PromptStatus.ACTIVE,
  metadata: {
    usageCount: 0,
    successRate: 0,
    lastUsed: new Date(),
    aiModel: 'gpt-4',
    averageResponseTime: 0,
    totalTokens: 0,
    costEstimate: 0
  },
  createdAt: new Date(),
  updatedAt: new Date()
};

const validWorkspaceData: WorkspaceCreatePayload = {
  name: 'Test Workspace',
  description: 'A valid test workspace',
  teamId: '123e4567-e89b-12d3-a456-426614174000',
  settings: {
    isPublic: false,
    allowComments: true,
    autoSave: true,
    realTimeCollaboration: true,
    versionHistory: true
  },
  initialMembers: [
    {
      userId: '123e4567-e89b-12d3-a456-426614174001',
      role: WorkspaceRole.ADMIN
    }
  ]
};

describe('validatePrompt', () => {
  test('should validate a correctly formatted prompt', async () => {
    await expect(validatePrompt(validPromptData)).resolves.toBe(true);
  });

  test('should reject prompt with invalid title length', async () => {
    const invalidPrompt = { ...validPromptData, title: 'a' };
    await expect(validatePrompt(invalidPrompt)).rejects.toThrow();
  });

  test('should reject prompt with XSS content', async () => {
    const xssPrompt = { 
      ...validPromptData, 
      content: '<script>alert("xss")</script>Test content' 
    };
    await expect(validatePrompt(xssPrompt)).rejects.toThrow();
  });

  test('should validate prompt with maximum allowed content length', async () => {
    const longPrompt = { 
      ...validPromptData, 
      content: 'a'.repeat(5000) 
    };
    await expect(validatePrompt(longPrompt)).resolves.toBe(true);
  });

  test('should reject prompt exceeding maximum content length', async () => {
    const tooLongPrompt = { 
      ...validPromptData, 
      content: 'a'.repeat(5001) 
    };
    await expect(validatePrompt(tooLongPrompt)).rejects.toThrow();
  });

  test('should validate prompt with valid variables', async () => {
    const promptWithVars = {
      ...validPromptData,
      variables: [
        {
          name: 'testVar',
          value: 'test',
          type: 'string',
          description: 'Test variable',
          required: true
        }
      ]
    };
    await expect(validatePrompt(promptWithVars)).resolves.toBe(true);
  });
});

describe('validateEmail', () => {
  test('should validate correct email formats', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('test.name@example.co.uk')).toBe(true);
    expect(validateEmail('test+label@example.com')).toBe(true);
  });

  test('should reject invalid email formats', () => {
    expect(validateEmail('test@')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('test@example')).toBe(false);
    expect(validateEmail('test@.com')).toBe(false);
  });

  test('should reject emails with invalid characters', () => {
    expect(validateEmail('test<script>@example.com')).toBe(false);
    expect(validateEmail('test"name@example.com')).toBe(false);
    expect(validateEmail('test@exam"ple.com')).toBe(false);
  });

  test('should reject emails exceeding length limits', () => {
    const longLocalPart = 'a'.repeat(65) + '@example.com';
    const longDomain = 'test@' + 'a'.repeat(256) + '.com';
    expect(validateEmail(longLocalPart)).toBe(false);
    expect(validateEmail(longDomain)).toBe(false);
  });
});

describe('validateWorkspacePayload', () => {
  test('should validate correct workspace payload', async () => {
    await expect(validateWorkspacePayload(validWorkspaceData)).resolves.toBe(true);
  });

  test('should reject workspace with invalid name', async () => {
    const invalidWorkspace = {
      ...validWorkspaceData,
      name: '<script>alert("xss")</script>'
    };
    await expect(validateWorkspacePayload(invalidWorkspace)).rejects.toThrow();
  });

  test('should reject workspace with invalid member roles', async () => {
    const invalidMembers = {
      ...validWorkspaceData,
      initialMembers: [
        {
          userId: '123e4567-e89b-12d3-a456-426614174001',
          role: 'INVALID_ROLE'
        }
      ]
    };
    await expect(validateWorkspacePayload(invalidMembers)).rejects.toThrow();
  });

  test('should validate workspace with maximum description length', async () => {
    const longDescription = {
      ...validWorkspaceData,
      description: 'a'.repeat(500)
    };
    await expect(validateWorkspacePayload(longDescription)).resolves.toBe(true);
  });
});

describe('sanitizeInput', () => {
  test('should remove HTML tags', () => {
    const input = '<p>Test content</p><script>alert("xss")</script>';
    expect(sanitizeInput(input)).toBe('Test content');
  });

  test('should escape special characters', () => {
    const input = '&<>"\'Test content';
    expect(sanitizeInput(input)).toBe('&amp;&lt;&gt;&quot;&#x27;Test content');
  });

  test('should handle empty input', () => {
    expect(sanitizeInput('')).toBe('');
    expect(sanitizeInput(null as unknown as string)).toBe('');
    expect(sanitizeInput(undefined as unknown as string)).toBe('');
  });

  test('should normalize whitespace', () => {
    const input = 'Test    content\n\nwith    spaces';
    expect(sanitizeInput(input)).toBe('Test content with spaces');
  });

  test('should remove control characters', () => {
    const input = 'Test\x00content\x1Fwith\x7Fcontrol\x9Fchars';
    expect(sanitizeInput(input)).toBe('Test content with control chars');
  });
});