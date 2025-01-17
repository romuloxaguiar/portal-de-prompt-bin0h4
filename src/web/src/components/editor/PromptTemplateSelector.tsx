/**
 * A React component that provides a user interface for selecting and managing prompt templates.
 * Implements advanced features like template preview, analytics tracking, and accessibility support.
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react'; // ^18.0.0
import { 
  Box, 
  TextField, 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material'; // ^5.0.0
import { debounce } from 'lodash'; // ^4.17.21
import { usePrompt } from '../../hooks/usePrompt';
import { useAnalytics } from '../../hooks/useAnalytics';
import { IPrompt } from '../../interfaces/prompt.interface';
import ErrorBoundary from '../common/ErrorBoundary';

/**
 * Props interface for PromptTemplateSelector component
 */
interface PromptTemplateSelectorProps {
  workspaceId: string;
  onSelect: (template: IPrompt) => void;
  selectedTemplateId: string | null;
  language: string;
  category: string | null;
}

/**
 * Component for selecting and managing prompt templates with enhanced features
 */
const PromptTemplateSelector: React.FC<PromptTemplateSelectorProps> = ({
  workspaceId,
  onSelect,
  selectedTemplateId,
  language,
  category
}) => {
  // Theme and styles
  const theme = useTheme();

  // State management
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredTemplates, setFilteredTemplates] = useState<IPrompt[]>([]);
  const [previewTemplate, setPreviewTemplate] = useState<IPrompt | null>(null);

  // Custom hooks
  const { prompts, loading, error } = usePrompt(workspaceId, {
    enableCache: true,
    analyticsEnabled: true
  });

  const { trackAnalyticsEvent } = useAnalytics({
    batchEvents: true,
    cacheResults: true
  });

  // Memoized filtered templates based on search, language, and category
  const templates = useMemo(() => {
    return prompts.filter(prompt => {
      const matchesSearch = searchQuery.toLowerCase().trim() === '' ||
        prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prompt.content.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLanguage = language === '' || prompt.language === language;
      const matchesCategory = !category || prompt.category === category;

      return matchesSearch && matchesLanguage && matchesCategory;
    });
  }, [prompts, searchQuery, language, category]);

  // Debounced search handler
  const handleSearch = useCallback(
    debounce((query: string) => {
      setSearchQuery(query);
      trackAnalyticsEvent({
        type: 'template_search',
        data: { query, resultsCount: filteredTemplates.length }
      });
    }, 300),
    [trackAnalyticsEvent]
  );

  // Template selection handler with analytics
  const handleTemplateSelect = useCallback((template: IPrompt) => {
    onSelect(template);
    trackAnalyticsEvent({
      type: 'template_selected',
      data: {
        templateId: template.id,
        category: template.category,
        language: template.language
      }
    });
  }, [onSelect, trackAnalyticsEvent]);

  // Preview handler
  const handlePreview = useCallback((template: IPrompt) => {
    setPreviewTemplate(template);
    trackAnalyticsEvent({
      type: 'template_preview',
      data: { templateId: template.id }
    });
  }, [trackAnalyticsEvent]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewTemplate(null);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Error handling
  if (error) {
    return (
      <Box role="alert" aria-live="polite" p={2}>
        <Typography color="error">
          Failed to load templates. Please try again later.
        </Typography>
      </Box>
    );
  }

  return (
    <ErrorBoundary>
      <Box sx={{ width: '100%', height: '100%' }}>
        {/* Search Bar */}
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search templates..."
          onChange={(e) => handleSearch(e.target.value)}
          InputProps={{
            'aria-label': 'Search templates',
            startAdornment: loading && <CircularProgress size={20} />,
          }}
          sx={{ mb: 2 }}
        />

        {/* Templates Grid */}
        <Grid container spacing={2}>
          {templates.map((template) => (
            <Grid item xs={12} sm={6} md={4} key={template.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: selectedTemplateId === template.id ? 
                    `2px solid ${theme.palette.primary.main}` : 
                    'none'
                }}
                onClick={() => handleTemplateSelect(template)}
                onMouseEnter={() => handlePreview(template)}
                onMouseLeave={() => setPreviewTemplate(null)}
                aria-selected={selectedTemplateId === template.id}
                role="option"
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {template.title}
                  </Typography>
                  <Chip 
                    label={template.category}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <Chip 
                    label={template.language}
                    size="small"
                  />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mt: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {template.content}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Template Preview Modal */}
        {previewTemplate && (
          <Box
            sx={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              width: 400,
              bgcolor: 'background.paper',
              boxShadow: 24,
              p: 2,
              borderRadius: 1,
            }}
            role="dialog"
            aria-label="Template preview"
          >
            <Typography variant="h6" gutterBottom>
              {previewTemplate.title}
            </Typography>
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2">
              {previewTemplate.content}
            </Typography>
          </Box>
        )}

        {/* Empty State */}
        {templates.length === 0 && !loading && (
          <Box
            sx={{
              textAlign: 'center',
              py: 4
            }}
            role="status"
          >
            <Typography variant="body1" color="text.secondary">
              No templates found matching your criteria.
            </Typography>
          </Box>
        )}
      </Box>
    </ErrorBoundary>
  );
};

export default PromptTemplateSelector;