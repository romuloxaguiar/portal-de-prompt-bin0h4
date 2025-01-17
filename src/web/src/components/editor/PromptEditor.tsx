import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import MonacoEditor from '@monaco-editor/react';
import { debounce } from 'lodash';

import PromptTemplateSelector from './PromptTemplateSelector';
import AIModelSelector from './AIModelSelector';
import VariableManager from './VariableManager';
import { usePrompt } from '../../hooks/usePrompt';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { validateEditorContent, extractVariables } from '../../utils/editor.util';
import { EDITOR_CONFIG, EDITOR_VALIDATION, EDITOR_ACTIONS } from '../../constants/editor.constant';
import { IPromptVariable } from '../../interfaces/prompt.interface';
import { AIModelProvider, AIModel } from '../../config/ai-models.config';

interface PromptEditorProps {
  workspaceId: string;
  promptId: string | null;
  onSave: (prompt: any) => Promise<void>;
  onError?: (error: Error) => void;
  className?: string;
  initialContent?: string;
  readOnly?: boolean;
}

interface EditorState {
  content: string;
  variables: IPromptVariable[];
  selectedModel: string;
  modelConfig: AIModel | null;
  isDirty: boolean;
  isValidating: boolean;
  validationErrors: string[];
  isSaving: boolean;
}

export const PromptEditor: React.FC<PromptEditorProps> = React.memo(({
  workspaceId,
  promptId,
  onSave,
  onError,
  className,
  initialContent = '',
  readOnly = false
}) => {
  // Editor state
  const [state, setState] = useState<EditorState>({
    content: initialContent,
    variables: [],
    selectedModel: `${AIModelProvider.OPENAI}/gpt-4`,
    modelConfig: null,
    isDirty: false,
    isValidating: false,
    validationErrors: [],
    isSaving: false
  });

  // Refs
  const editorRef = useRef<any>(null);
  const validationTimer = useRef<NodeJS.Timeout>();

  // Custom hooks
  const { createPrompt, updatePrompt, selectedPrompt } = usePrompt(workspaceId, {
    enableCache: true,
    analyticsEnabled: true
  });

  // Debounced content validation
  const validateContent = useMemo(() => debounce(async (content: string) => {
    setState(prev => ({ ...prev, isValidating: true }));
    
    const validationResult = validateEditorContent(content, {
      checkAccessibility: true,
      maxLength: EDITOR_VALIDATION.maxLength,
      validateVariables: true
    });

    setState(prev => ({
      ...prev,
      isValidating: false,
      validationErrors: validationResult.errors,
      isDirty: true
    }));
  }, 500), []);

  // Handle content changes
  const handleContentChange = useCallback((newContent: string) => {
    setState(prev => ({ ...prev, content: newContent, isDirty: true }));
    
    if (validationTimer.current) {
      clearTimeout(validationTimer.current);
    }
    
    validationTimer.current = setTimeout(() => {
      validateContent(newContent);
    }, 500);
  }, [validateContent]);

  // Handle variable changes
  const handleVariablesChange = useCallback((newVariables: IPromptVariable[]) => {
    setState(prev => ({
      ...prev,
      variables: newVariables,
      isDirty: true
    }));
  }, []);

  // Handle AI model changes
  const handleModelChange = useCallback((modelId: string, provider: AIModelProvider, modelConfig: AIModel) => {
    setState(prev => ({
      ...prev,
      selectedModel: `${provider}/${modelId}`,
      modelConfig,
      isDirty: true
    }));
  }, []);

  // Handle save action
  const handleSave = async () => {
    try {
      setState(prev => ({ ...prev, isSaving: true }));

      const promptData = {
        content: state.content,
        variables: state.variables,
        aiModel: state.selectedModel,
        modelConfig: state.modelConfig,
        workspaceId
      };

      if (promptId) {
        await updatePrompt(promptId, promptData);
      } else {
        await createPrompt(promptData);
      }

      setState(prev => ({
        ...prev,
        isDirty: false,
        isSaving: false
      }));

      onSave(promptData);
    } catch (error) {
      setState(prev => ({ ...prev, isSaving: false }));
      if (onError) onError(error as Error);
    }
  };

  // Load initial prompt data
  useEffect(() => {
    if (selectedPrompt) {
      setState(prev => ({
        ...prev,
        content: selectedPrompt.content,
        variables: selectedPrompt.variables,
        selectedModel: selectedPrompt.aiModel,
        modelConfig: selectedPrompt.modelConfig,
        isDirty: false
      }));
    }
  }, [selectedPrompt]);

  return (
    <ErrorBoundary onError={onError}>
      <Box className={className} sx={{ width: '100%', height: '100%' }}>
        <Grid container spacing={2}>
          {/* Editor Header */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                {promptId ? 'Edit Prompt' : 'Create New Prompt'}
              </Typography>
              <AIModelSelector
                selectedModel={state.selectedModel}
                onModelChange={handleModelChange}
                disabled={readOnly}
              />
            </Paper>
          </Grid>

          {/* Main Editor */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <MonacoEditor
                ref={editorRef}
                height={EDITOR_CONFIG.maxHeight}
                language="markdown"
                theme="vs-light"
                value={state.content}
                onChange={handleContentChange}
                options={{
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  readOnly,
                  fontSize: parseInt(EDITOR_CONFIG.fontSize),
                  fontFamily: EDITOR_CONFIG.fontFamily
                }}
              />
            </Paper>
          </Grid>

          {/* Variable Manager */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <VariableManager
                content={state.content}
                variables={state.variables}
                onVariablesChange={handleVariablesChange}
                disabled={readOnly}
                validationOptions={{
                  maxVariables: EDITOR_VALIDATION.maxVariables,
                  validateNames: true,
                  allowDuplicates: false
                }}
                a11yConfig={{
                  announceChanges: true,
                  keyboardNavigation: true
                }}
                onError={onError}
              />
            </Paper>
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              {state.validationErrors.length > 0 && (
                <Alert severity="error" sx={{ flexGrow: 1 }}>
                  {state.validationErrors.join(', ')}
                </Alert>
              )}
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={!state.isDirty || state.isSaving || readOnly || state.validationErrors.length > 0}
                startIcon={state.isSaving && <CircularProgress size={20} />}
              >
                {state.isSaving ? 'Saving...' : 'Save Prompt'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </ErrorBoundary>
  );
});

PromptEditor.displayName = 'PromptEditor';

export default PromptEditor;