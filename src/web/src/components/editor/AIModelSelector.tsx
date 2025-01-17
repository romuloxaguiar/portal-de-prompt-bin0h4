import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Tooltip,
  CircularProgress,
  Alert,
  SelectChangeEvent,
} from '@mui/material';
import {
  AIModelsConfig,
  AIModelProvider,
  AIProviderConfig,
  AIModel,
  getModelConfig,
} from '../../config/ai-models.config';

// Styled components for enhanced visual hierarchy
const StyledFormControl = styled(FormControl)(({ theme }) => ({
  minWidth: 200,
  marginBottom: theme.spacing(2),
  '& .MuiInputLabel-root': {
    color: theme.palette.text.secondary,
  },
  '& .MuiSelect-select': {
    paddingRight: theme.spacing(4),
  },
}));

const ProviderGroup = styled(Typography)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  backgroundColor: theme.palette.action.hover,
  color: theme.palette.text.secondary,
  fontWeight: 500,
}));

const ModelMenuItem = styled(MenuItem)(({ theme }) => ({
  paddingLeft: theme.spacing(3),
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  '& .model-info': {
    display: 'flex',
    flexDirection: 'column',
  },
  '& .model-description': {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
}));

// Interface definitions
interface AIModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string, provider: AIModelProvider, modelConfig: AIModel) => void;
  disabled?: boolean;
  error?: string | null;
}

interface GroupedModel {
  provider: AIModelProvider;
  config: AIProviderConfig;
  models: Array<[string, AIModel]>;
}

// Main component
export const AIModelSelector: React.FC<AIModelSelectorProps> = React.memo(({
  selectedModel,
  onModelChange,
  disabled = false,
  error = null,
}) => {
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Memoized grouped models for optimal rendering
  const groupedModels = useMemo((): GroupedModel[] => {
    return Object.entries(AIModelsConfig.providers)
      .filter(([_, config]) => config.isEnabled)
      .map(([provider, config]) => ({
        provider: provider as AIModelProvider,
        config,
        models: Object.entries(config.models)
          .sort(([, a], [, b]) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.config.displayName.localeCompare(b.config.displayName));
  }, []);

  // Enhanced model change handler with validation
  const handleModelChange = useCallback(async (event: SelectChangeEvent<string>) => {
    const modelId = event.target.value;
    setLocalError(null);
    setLoading(true);

    try {
      // Extract provider from model ID format: 'provider/model-id'
      const [providerStr, modelIdentifier] = modelId.split('/');
      const provider = providerStr as AIModelProvider;

      if (!Object.values(AIModelProvider).includes(provider)) {
        throw new Error('Invalid provider selected');
      }

      const modelConfig = getModelConfig(provider, modelIdentifier);
      
      // Validate model availability
      if (!AIModelsConfig.providers[provider].isEnabled) {
        throw new Error(`${AIModelsConfig.providers[provider].displayName} is currently unavailable`);
      }

      onModelChange(modelIdentifier, provider, modelConfig);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to select model');
    } finally {
      setLoading(false);
    }
  }, [onModelChange]);

  // Reset local error when prop error changes
  useEffect(() => {
    if (error) {
      setLocalError(error);
    }
  }, [error]);

  return (
    <>
      <StyledFormControl
        error={!!localError}
        disabled={disabled || loading}
        variant="outlined"
        fullWidth
      >
        <InputLabel id="ai-model-selector-label">
          AI Model
        </InputLabel>
        <Select
          labelId="ai-model-selector-label"
          id="ai-model-selector"
          value={selectedModel}
          onChange={handleModelChange}
          label="AI Model"
          renderValue={(selected) => {
            const [provider, modelId] = selected.split('/');
            const modelConfig = AIModelsConfig.providers[provider as AIModelProvider]?.models[modelId];
            return modelConfig?.name || selected;
          }}
          startAdornment={loading && (
            <CircularProgress size={20} color="inherit" sx={{ ml: 1 }} />
          )}
        >
          {groupedModels.map(({ provider, config, models }) => (
            <React.Fragment key={provider}>
              <ProviderGroup variant="subtitle2">
                {config.displayName}
              </ProviderGroup>
              {models.map(([modelId, model]) => (
                <Tooltip
                  key={`${provider}/${modelId}`}
                  title={
                    <React.Fragment>
                      <Typography variant="subtitle2">{model.name}</Typography>
                      <Typography variant="body2">
                        Max tokens: {model.maxTokens.toLocaleString()}
                      </Typography>
                      <Typography variant="body2">
                        Features: {model.supportedFeatures.join(', ')}
                      </Typography>
                    </React.Fragment>
                  }
                  placement="right"
                >
                  <ModelMenuItem value={`${provider}/${modelId}`}>
                    <div className="model-info">
                      <Typography>{model.name}</Typography>
                      <Typography className="model-description">
                        {model.description}
                      </Typography>
                    </div>
                  </ModelMenuItem>
                </Tooltip>
              ))}
            </React.Fragment>
          ))}
        </Select>
      </StyledFormControl>
      {localError && (
        <Alert 
          severity="error" 
          sx={{ mt: 1 }}
          onClose={() => setLocalError(null)}
        >
          {localError}
        </Alert>
      )}
    </>
  );
});

AIModelSelector.displayName = 'AIModelSelector';

export default AIModelSelector;