/**
 * @fileoverview Enhanced React component for managing prompt variables with validation and accessibility
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  Tooltip,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

import { IPromptVariable } from '../../interfaces/prompt.interface';
import { extractVariables } from '../../utils/editor.util';
import { VARIABLE_MARKERS, EDITOR_VALIDATION } from '../../constants/editor.constant';

// Props interface with enhanced type safety
interface VariableManagerProps {
  content: string;
  variables: IPromptVariable[];
  onVariablesChange: (variables: IPromptVariable[]) => void;
  disabled?: boolean;
  validationOptions?: {
    maxVariables?: number;
    validateNames?: boolean;
    allowDuplicates?: boolean;
  };
  a11yConfig?: {
    announceChanges?: boolean;
    keyboardNavigation?: boolean;
  };
  onError?: (error: Error) => void;
}

// Variable validation cache for performance optimization
class ValidationCache {
  private cache: Map<string, boolean> = new Map();

  validate(name: string): boolean {
    if (!this.cache.has(name)) {
      const isValid = EDITOR_VALIDATION.variableNamePattern.test(name);
      this.cache.set(name, isValid);
    }
    return this.cache.get(name) || false;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const VariableManager: React.FC<VariableManagerProps> = ({
  content,
  variables,
  onVariablesChange,
  disabled = false,
  validationOptions = {},
  a11yConfig = {},
  onError
}) => {
  const [localVariables, setLocalVariables] = useState<IPromptVariable[]>(variables);
  const [editingVariable, setEditingVariable] = useState<IPromptVariable | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const validationCache = useRef(new ValidationCache());
  const listRef = useRef<HTMLUListElement>(null);

  // Effect to sync content variables with local state
  useEffect(() => {
    const { variables: extractedVars, isValid, errors } = extractVariables(content);
    if (!isValid && onError) {
      onError(new Error(errors.join(', ')));
    }

    const updatedVariables = localVariables.filter(v => 
      extractedVars.includes(v.name)
    );

    setLocalVariables(updatedVariables);
    onVariablesChange(updatedVariables);
  }, [content]);

  // Secure variable name validation
  const validateVariableName = useCallback((name: string): boolean => {
    if (!name) return false;
    if (!validationCache.current.validate(name)) return false;
    if (!validationOptions.allowDuplicates && 
        localVariables.some(v => v.name === name)) return false;
    return true;
  }, [localVariables, validationOptions]);

  // Handle variable addition with validation
  const handleAddVariable = useCallback(async (variable: IPromptVariable) => {
    try {
      const errors: string[] = [];
      
      if (!validateVariableName(variable.name)) {
        errors.push('Invalid variable name');
      }

      if (validationOptions.maxVariables && 
          localVariables.length >= validationOptions.maxVariables) {
        errors.push(`Maximum ${validationOptions.maxVariables} variables allowed`);
      }

      if (errors.length > 0) {
        setValidationErrors(errors);
        return;
      }

      const sanitizedVariable: IPromptVariable = {
        ...variable,
        name: variable.name.trim(),
        description: variable.description?.trim() || '',
        required: !!variable.required
      };

      setLocalVariables(prev => [...prev, sanitizedVariable]);
      onVariablesChange([...localVariables, sanitizedVariable]);
      setValidationErrors([]);
      
      if (a11yConfig.announceChanges) {
        announceChange(`Added variable ${variable.name}`);
      }
    } catch (error) {
      if (onError) onError(error as Error);
    }
  }, [localVariables, validationOptions, a11yConfig]);

  // Handle variable editing with validation
  const handleEditVariable = useCallback(async (
    name: string,
    updatedVariable: IPromptVariable
  ) => {
    try {
      if (name !== updatedVariable.name && 
          !validateVariableName(updatedVariable.name)) {
        setValidationErrors(['Invalid variable name']);
        return;
      }

      const updatedVariables = localVariables.map(v =>
        v.name === name ? { ...updatedVariable } : v
      );

      setLocalVariables(updatedVariables);
      onVariablesChange(updatedVariables);
      setValidationErrors([]);
      setEditingVariable(null);
      setIsDialogOpen(false);

      if (a11yConfig.announceChanges) {
        announceChange(`Updated variable ${name}`);
      }
    } catch (error) {
      if (onError) onError(error as Error);
    }
  }, [localVariables, a11yConfig]);

  // Handle variable removal with dependency checking
  const handleRemoveVariable = useCallback(async (name: string) => {
    try {
      const updatedVariables = localVariables.filter(v => v.name !== name);
      setLocalVariables(updatedVariables);
      onVariablesChange(updatedVariables);

      if (a11yConfig.announceChanges) {
        announceChange(`Removed variable ${name}`);
      }
    } catch (error) {
      if (onError) onError(error as Error);
    }
  }, [localVariables, a11yConfig]);

  // Accessibility announcement helper
  const announceChange = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  return (
    <Box
      role="region"
      aria-label="Variable Manager"
      sx={{ mt: 2, mb: 2 }}
    >
      {validationErrors.length > 0 && (
        <Alert 
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setValidationErrors([])}
        >
          {validationErrors.join(', ')}
        </Alert>
      )}

      <List ref={listRef} aria-label="Variables list">
        {localVariables.map((variable, index) => (
          <ListItem
            key={variable.name}
            divider
            role="listitem"
            tabIndex={a11yConfig.keyboardNavigation ? 0 : -1}
          >
            <ListItemText
              primary={variable.name}
              secondary={variable.description}
              primaryTypographyProps={{
                'aria-label': `Variable name: ${variable.name}`
              }}
            />
            <ListItemSecondaryAction>
              <Tooltip title="Edit variable">
                <IconButton
                  edge="end"
                  aria-label={`Edit variable ${variable.name}`}
                  onClick={() => {
                    setEditingVariable(variable);
                    setIsDialogOpen(true);
                  }}
                  disabled={disabled}
                >
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Remove variable">
                <IconButton
                  edge="end"
                  aria-label={`Remove variable ${variable.name}`}
                  onClick={() => handleRemoveVariable(variable.name)}
                  disabled={disabled}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      <Button
        startIcon={<AddIcon />}
        onClick={() => {
          setEditingVariable(null);
          setIsDialogOpen(true);
        }}
        disabled={disabled}
        sx={{ mt: 2 }}
        aria-label="Add new variable"
      >
        Add Variable
      </Button>

      <Dialog
        open={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingVariable(null);
        }}
        aria-labelledby="variable-dialog-title"
      >
        <DialogTitle id="variable-dialog-title">
          {editingVariable ? 'Edit Variable' : 'Add Variable'}
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <TextField
              label="Name"
              defaultValue={editingVariable?.name || ''}
              required
              inputProps={{
                'aria-label': 'Variable name',
                pattern: EDITOR_VALIDATION.variableNamePattern.source
              }}
            />
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <TextField
              label="Description"
              defaultValue={editingVariable?.description || ''}
              multiline
              rows={2}
              inputProps={{
                'aria-label': 'Variable description'
              }}
            />
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="variable-type-label">Type</InputLabel>
            <Select
              labelId="variable-type-label"
              defaultValue={editingVariable?.type || 'string'}
              label="Type"
            >
              <MenuItem value="string">String</MenuItem>
              <MenuItem value="number">Number</MenuItem>
              <MenuItem value="boolean">Boolean</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsDialogOpen(false);
              setEditingVariable(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              // Form submission logic
            }}
            variant="contained"
          >
            {editingVariable ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VariableManager;