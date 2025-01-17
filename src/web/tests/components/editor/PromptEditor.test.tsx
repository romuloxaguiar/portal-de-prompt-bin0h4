import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { axe } from '@axe-core/react';

import PromptEditor from '../../src/components/editor/PromptEditor';
import { usePrompt } from '../../src/hooks/usePrompt';
import { AIModelProvider } from '../../config/ai-models.config';
import { EDITOR_VALIDATION } from '../../constants/editor.constant';

// Mock dependencies
vi.mock('../../src/hooks/usePrompt');
vi.mock('../../src/components/editor/AIModelSelector', () => ({
  __esModule: true,
  default: ({ selectedModel, onModelChange }) => (
    <select
      data-testid="ai-model-selector"
      value={selectedModel}
      onChange={(e) => onModelChange(e.target.value, AIModelProvider.OPENAI, {})}
    >
      <option value={`${AIModelProvider.OPENAI}/gpt-4`}>GPT-4</option>
      <option value={`${AIModelProvider.ANTHROPIC}/claude-2`}>Claude 2</option>
    </select>
  )
}));

vi.mock('../../src/components/editor/VariableManager', () => ({
  __esModule: true,
  default: ({ variables, onVariablesChange }) => (
    <div data-testid="variable-manager">
      <button
        onClick={() => onVariablesChange([...variables, { name: 'newVar', type: 'string' }])}
      >
        Add Variable
      </button>
      <ul>
        {variables.map(v => (
          <li key={v.name}>{v.name}</li>
        ))}
      </ul>
    </div>
  )
}));

// Test utilities
const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  return render(ui, {
    wrapper: ({ children }) => (
      <div>{children}</div>
    ),
    ...options,
  });
};

describe('PromptEditor Component', () => {
  const mockOnSave = vi.fn();
  const mockOnError = vi.fn();
  const defaultProps = {
    workspaceId: 'workspace-123',
    promptId: null,
    onSave: mockOnSave,
    onError: mockOnError,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (usePrompt as jest.Mock).mockReturnValue({
      createPrompt: vi.fn(),
      updatePrompt: vi.fn(),
      selectedPrompt: null,
    });
  });

  describe('Rendering and Initialization', () => {
    it('renders editor interface with all required components', async () => {
      renderWithProviders(<PromptEditor {...defaultProps} />);

      expect(screen.getByRole('heading')).toHaveTextContent('Create New Prompt');
      expect(screen.getByTestId('ai-model-selector')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByTestId('variable-manager')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    it('initializes with provided content and variables', () => {
      const initialContent = 'Test prompt with {{variable}}';
      renderWithProviders(
        <PromptEditor
          {...defaultProps}
          initialContent={initialContent}
        />
      );

      expect(screen.getByRole('textbox')).toHaveValue(initialContent);
    });

    it('meets accessibility requirements', async () => {
      const { container } = renderWithProviders(<PromptEditor {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Content Editing and Validation', () => {
    it('validates content length against maximum limit', async () => {
      renderWithProviders(<PromptEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      const longContent = 'a'.repeat(EDITOR_VALIDATION.maxLength + 1);
      await userEvent.type(editor, longContent);

      expect(screen.getByRole('alert')).toHaveTextContent(/exceeds maximum length/i);
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    it('handles variable extraction and validation', async () => {
      renderWithProviders(<PromptEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      await userEvent.type(editor, 'Hello {{name}}, welcome to {{company}}');
      
      const variableManager = screen.getByTestId('variable-manager');
      const variables = within(variableManager).getAllByRole('listitem');
      expect(variables).toHaveLength(2);
      expect(variables[0]).toHaveTextContent('name');
      expect(variables[1]).toHaveTextContent('company');
    });

    it('maintains undo/redo history', async () => {
      renderWithProviders(<PromptEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      await userEvent.type(editor, 'First line');
      await userEvent.keyboard('{Control>}z{/Control}');
      expect(editor).toHaveValue('');

      await userEvent.keyboard('{Control>}y{/Control}');
      expect(editor).toHaveValue('First line');
    });
  });

  describe('AI Model Integration', () => {
    it('handles AI model selection changes', async () => {
      renderWithProviders(<PromptEditor {...defaultProps} />);
      const modelSelector = screen.getByTestId('ai-model-selector');

      await userEvent.selectOptions(modelSelector, `${AIModelProvider.ANTHROPIC}/claude-2`);
      expect(modelSelector).toHaveValue(`${AIModelProvider.ANTHROPIC}/claude-2`);
    });

    it('validates content against selected model constraints', async () => {
      renderWithProviders(<PromptEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');
      const modelSelector = screen.getByTestId('ai-model-selector');

      await userEvent.selectOptions(modelSelector, `${AIModelProvider.OPENAI}/gpt-4`);
      await userEvent.type(editor, 'a'.repeat(8193)); // Exceeds GPT-4 token limit

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Save and Error Handling', () => {
    it('handles successful prompt creation', async () => {
      const createPrompt = vi.fn().mockResolvedValue({ id: 'new-prompt-123' });
      (usePrompt as jest.Mock).mockReturnValue({ createPrompt });

      renderWithProviders(<PromptEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');
      const saveButton = screen.getByRole('button', { name: /save/i });

      await userEvent.type(editor, 'Valid prompt content');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(createPrompt).toHaveBeenCalledWith(expect.objectContaining({
          content: 'Valid prompt content',
        }));
        expect(mockOnSave).toHaveBeenCalled();
      });
    });

    it('handles save errors appropriately', async () => {
      const error = new Error('Failed to save prompt');
      const createPrompt = vi.fn().mockRejectedValue(error);
      (usePrompt as jest.Mock).mockReturnValue({ createPrompt });

      renderWithProviders(<PromptEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');
      const saveButton = screen.getByRole('button', { name: /save/i });

      await userEvent.type(editor, 'Test content');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(error);
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility and Keyboard Navigation', () => {
    it('supports keyboard navigation between components', async () => {
      renderWithProviders(<PromptEditor {...defaultProps} />);

      await userEvent.tab();
      expect(screen.getByTestId('ai-model-selector')).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByRole('textbox')).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByTestId('variable-manager')).toHaveFocus();
    });

    it('announces validation errors to screen readers', async () => {
      renderWithProviders(<PromptEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      await userEvent.type(editor, 'a'.repeat(EDITOR_VALIDATION.maxLength + 1));

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });
  });
});