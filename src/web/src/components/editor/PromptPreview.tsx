/**
 * PromptPreview Component
 * Provides real-time preview of AI prompt content with variable interpolation and formatting.
 * Implements accessibility features, error handling, and loading states.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import { IPrompt } from '../../interfaces/prompt.interface';
import { promptService } from '../../services/prompt.service';
import { ErrorCode } from '../../constants/error.constant';
import { createError } from '../../utils/error.util';

// Component props interface with strict typing
interface PromptPreviewProps {
  /** Content of the prompt */
  content: string;
  /** Variables used in the prompt */
  variables: IPrompt['variables'];
  /** ID of the AI model to use */
  modelId: string;
  /** Loading state indicator */
  isProcessing?: boolean;
  /** Number of retry attempts for failed previews */
  retryAttempts?: number;
  /** Error callback handler */
  onError?: (error: string) => void;
}

/**
 * Processes variables in prompt content with type validation
 */
const interpolateVariables = (content: string, variables: IPrompt['variables']): string => {
  if (!content || !variables) return content;

  let processedContent = content;
  const variableMap = new Map(variables.map(v => [v.name, v]));

  // Find all variable placeholders in content
  const placeholders = content.match(/\{([^}]+)\}/g) || [];

  placeholders.forEach(placeholder => {
    const varName = placeholder.slice(1, -1);
    const variable = variableMap.get(varName);

    if (!variable) {
      throw createError(ErrorCode.PROMPT_VALIDATION_ERROR, {
        message: `Variable ${varName} not found in variables list`
      });
    }

    // Type validation before replacement
    if (variable.required && !variable.value) {
      throw createError(ErrorCode.PROMPT_VALIDATION_ERROR, {
        message: `Required variable ${varName} has no value`
      });
    }

    processedContent = processedContent.replace(
      placeholder,
      String(variable.value ?? '')
    );
  });

  return processedContent;
};

/**
 * Formats prompt content for display with enhanced readability
 */
const formatContent = (content: string): string => {
  if (!content) return '';

  return content
    .trim()
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple line breaks
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/([.!?])\s*/g, '$1\n') // Add line breaks after sentences
    .trim();
};

/**
 * PromptPreview component for displaying processed prompt content
 */
const PromptPreview: React.FC<PromptPreviewProps> = React.memo(({
  content,
  variables,
  modelId,
  isProcessing = false,
  retryAttempts = 3,
  onError
}) => {
  // State management
  const [processedContent, setProcessedContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  /**
   * Processes and validates prompt content with error handling
   */
  const processContent = useCallback(async () => {
    try {
      // Reset error state
      setError(null);

      // Process variables
      const interpolatedContent = interpolateVariables(content, variables);
      const formattedContent = formatContent(interpolatedContent);

      // Test prompt with AI model
      const result = await promptService.testPrompt(modelId, {
        content: formattedContent,
        variables: variables.reduce((acc, v) => ({ ...acc, [v.name]: v.value }), {})
      });

      setProcessedContent(result.processedContent);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process prompt';
      setError(errorMessage);
      onError?.(errorMessage);

      // Implement retry logic
      if (retryCount < retryAttempts) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => processContent(), 1000 * Math.pow(2, retryCount));
      }
    }
  }, [content, variables, modelId, retryCount, retryAttempts, onError]);

  // Process content when inputs change
  useEffect(() => {
    processContent();
  }, [processContent]);

  // Memoized styles for performance
  const styles = useMemo(() => ({
    container: {
      position: 'relative' as const,
      minHeight: '200px',
      padding: '16px',
      backgroundColor: 'background.paper'
    },
    content: {
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-word' as const,
      opacity: isProcessing ? 0.5 : 1,
      transition: 'opacity 0.2s ease-in-out'
    },
    loader: {
      position: 'absolute' as const,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    },
    error: {
      color: 'error.main',
      marginTop: '8px'
    }
  }), [isProcessing]);

  return (
    <Paper
      elevation={2}
      sx={styles.container}
      role="region"
      aria-label="Prompt Preview"
      aria-busy={isProcessing}
    >
      {isProcessing && (
        <Box sx={styles.loader}>
          <CircularProgress
            size={40}
            aria-label="Processing prompt"
          />
        </Box>
      )}

      <Typography
        component="div"
        variant="body1"
        sx={styles.content}
        aria-live="polite"
      >
        {processedContent}
      </Typography>

      {error && (
        <Typography
          variant="body2"
          sx={styles.error}
          role="alert"
        >
          {error}
        </Typography>
      )}
    </Paper>
  );
});

PromptPreview.displayName = 'PromptPreview';

export default PromptPreview;