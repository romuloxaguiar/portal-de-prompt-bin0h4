import React, { useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from 'lodash'; // v4.17.21
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  TextField,
  Divider,
} from '@mui/material'; // v5.0.0
import { styled } from '@mui/material/styles';
import { usePrompt } from '../../hooks/usePrompt';
import { promptService } from '../../services/prompt.service';
import { AIModelSelector } from './AIModelSelector';
import { handlePromptError } from '../../utils/error.util';
import { analyticsService } from '../../services/analytics.service';
import { MetricType } from '../../interfaces/analytics.interface';
import { AIModelProvider, AIModel } from '../../config/ai-models.config';

// Styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(2),
}));

const ResultBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
  minHeight: 120,
}));

// Interfaces
interface PromptTesterProps {
  promptId: string;
  onTestComplete?: (result: IPromptTestResult) => void;
  onError?: (error: IPromptError) => void;
  analyticsEnabled?: boolean;
}

interface IPromptTestResult {
  output: string;
  metrics: {
    tokens: number;
    latency: number;
    cost: number;
  };
  model: string;
  timestamp: Date;
}

interface IPromptError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

interface ITestState {
  isLoading: boolean;
  result: IPromptTestResult | null;
  error: IPromptError | null;
  selectedModel: string;
  variables: Record<string, string>;
  metrics: {
    successRate: number;
    averageLatency: number;
    totalTests: number;
  };
}

const DEBOUNCE_DELAY = 500;
const MAX_RETRIES = 3;

export const PromptTester: React.FC<PromptTesterProps> = React.memo(({
  promptId,
  onTestComplete,
  onError,
  analyticsEnabled = true
}) => {
  // State management
  const [state, setState] = useState<ITestState>({
    isLoading: false,
    result: null,
    error: null,
    selectedModel: `${AIModelProvider.OPENAI}/gpt-4`,
    variables: {},
    metrics: {
      successRate: 0,
      averageLatency: 0,
      totalTests: 0
    }
  });

  // Refs for tracking test metrics
  const testStartTime = useRef<number>(0);
  const retryCount = useRef<number>(0);

  // Custom hooks
  const { selectedPrompt, testPrompt } = usePrompt(promptId);

  // Track analytics
  const trackTestAttempt = useCallback(async (success: boolean, duration: number) => {
    if (!analyticsEnabled) return;

    try {
      await analyticsService.trackMetric({
        type: MetricType.PROMPT_ITERATIONS,
        promptId,
        value: 1,
        metadata: {
          success,
          duration,
          model: state.selectedModel,
          retryCount: retryCount.current
        }
      });
    } catch (error) {
      console.error('Analytics tracking failed:', error);
    }
  }, [promptId, state.selectedModel, analyticsEnabled]);

  // Handle model selection
  const handleModelChange = useCallback((
    modelId: string,
    provider: AIModelProvider,
    modelConfig: AIModel
  ) => {
    setState(prev => ({
      ...prev,
      selectedModel: `${provider}/${modelId}`,
      result: null,
      error: null
    }));

    if (analyticsEnabled) {
      analyticsService.trackMetric({
        type: MetricType.USAGE,
        promptId,
        value: 1,
        metadata: { action: 'model_change', model: modelId, provider }
      });
    }
  }, [promptId, analyticsEnabled]);

  // Handle variable changes
  const handleVariableChange = useCallback((name: string, value: string) => {
    setState(prev => ({
      ...prev,
      variables: {
        ...prev.variables,
        [name]: value
      },
      result: null,
      error: null
    }));
  }, []);

  // Execute prompt test with retry logic
  const executeTest = async () => {
    if (!selectedPrompt) return;

    testStartTime.current = Date.now();
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [provider, modelId] = state.selectedModel.split('/');
      const result = await promptService.testPrompt(promptId, {
        variables: state.variables,
        model: modelId,
        provider
      });

      const duration = Date.now() - testStartTime.current;
      await trackTestAttempt(true, duration);

      setState(prev => ({
        ...prev,
        isLoading: false,
        result,
        metrics: {
          successRate: (prev.metrics.successRate * prev.metrics.totalTests + 1) / (prev.metrics.totalTests + 1),
          averageLatency: (prev.metrics.averageLatency * prev.metrics.totalTests + duration) / (prev.metrics.totalTests + 1),
          totalTests: prev.metrics.totalTests + 1
        }
      }));

      onTestComplete?.(result);
    } catch (error) {
      const handledError = handlePromptError(error);
      
      if (retryCount.current < MAX_RETRIES) {
        retryCount.current++;
        await executeTest();
        return;
      }

      const duration = Date.now() - testStartTime.current;
      await trackTestAttempt(false, duration);

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: handledError
      }));

      onError?.(handledError);
    }
  };

  // Debounced test execution
  const debouncedTest = useCallback(
    debounce(() => executeTest(), DEBOUNCE_DELAY),
    [selectedPrompt, state.variables, state.selectedModel]
  );

  // Reset state when prompt changes
  useEffect(() => {
    setState(prev => ({
      ...prev,
      result: null,
      error: null,
      variables: {}
    }));
  }, [promptId]);

  return (
    <Box>
      <StyledPaper>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <AIModelSelector
              selectedModel={state.selectedModel}
              onModelChange={handleModelChange}
              disabled={state.isLoading}
              error={state.error?.message}
            />
          </Grid>

          {selectedPrompt?.variables && (
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Variables
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(selectedPrompt.variables).map(([name, schema]) => (
                  <Grid item xs={12} sm={6} key={name}>
                    <TextField
                      fullWidth
                      label={name}
                      value={state.variables[name] || ''}
                      onChange={(e) => handleVariableChange(name, e.target.value)}
                      disabled={state.isLoading}
                      required
                    />
                  </Grid>
                ))}
              </Grid>
            </Grid>
          )}

          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={debouncedTest}
              disabled={state.isLoading}
              startIcon={state.isLoading ? <CircularProgress size={20} /> : null}
              fullWidth
            >
              {state.isLoading ? 'Testing...' : 'Test Prompt'}
            </Button>
          </Grid>
        </Grid>
      </StyledPaper>

      {state.error && (
        <Alert 
          severity="error" 
          onClose={() => setState(prev => ({ ...prev, error: null }))}
          sx={{ mb: 2 }}
        >
          {state.error.message}
        </Alert>
      )}

      {state.result && (
        <StyledPaper>
          <Typography variant="h6" gutterBottom>
            Result
          </Typography>
          <ResultBox>
            <Typography variant="body1" whiteSpace="pre-wrap">
              {state.result.output}
            </Typography>
          </ResultBox>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color="textSecondary">
                Tokens Used
              </Typography>
              <Typography variant="body1">
                {state.result.metrics.tokens.toLocaleString()}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color="textSecondary">
                Latency
              </Typography>
              <Typography variant="body1">
                {state.result.metrics.latency.toFixed(2)}ms
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color="textSecondary">
                Cost
              </Typography>
              <Typography variant="body1">
                ${state.result.metrics.cost.toFixed(4)}
              </Typography>
            </Grid>
          </Grid>
        </StyledPaper>
      )}
    </Box>
  );
});

PromptTester.displayName = 'PromptTester';

export default PromptTester;