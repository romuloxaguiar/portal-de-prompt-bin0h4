import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from '@mui/material/styles';
import { 
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Sort as SortIcon,
  ViewModule as GridIcon,
  ViewList as ListIcon
} from '@mui/icons-material';

// Internal imports
import { SearchBar } from '../components/common/SearchBar';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { useAnalytics } from '../hooks/useAnalytics';
import { IPrompt, PromptStatus } from '../interfaces/prompt.interface';
import { useIntersectionObserver } from 'react-intersection-observer';
import { useQueryClient } from 'react-query';
import { VirtualGrid } from 'react-virtual-grid';

// Styled components
const StyledContainer = styled('div')(({ theme }) => ({
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default
}));

const StyledHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.spacing(2)
}));

const StyledControls = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1)
}));

const StyledPromptCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4]
  }
}));

// Interface for component state
interface PromptLibraryState {
  filteredPrompts: IPrompt[];
  totalCount: number;
  searchTerm: string;
  isLoading: boolean;
  error: Error | null;
  viewMode: 'grid' | 'list';
  sortBy: 'date' | 'name' | 'usage';
  sortOrder: 'asc' | 'desc';
}

const PromptLibrary: React.FC = () => {
  // Hooks
  const theme = useTheme();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { trackAnalyticsEvent } = useAnalytics();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State
  const [state, setState] = useState<PromptLibraryState>({
    filteredPrompts: [],
    totalCount: 0,
    searchTerm: '',
    isLoading: true,
    error: null,
    viewMode: 'grid',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  // Intersection observer for infinite scroll
  const { ref, inView } = useIntersectionObserver({
    threshold: 0.5,
    triggerOnce: false
  });

  // Memoized grid configuration
  const gridConfig = useMemo(() => ({
    columnCount: isMobile ? 1 : 3,
    rowHeight: 200,
    gap: theme.spacing(2),
    overscanCount: 2
  }), [isMobile, theme]);

  // Search handler with debounce and analytics
  const handleSearch = useCallback((searchTerm: string) => {
    setState(prev => ({ ...prev, searchTerm, isLoading: true }));
    trackAnalyticsEvent({
      type: 'prompt_search',
      data: { term: searchTerm }
    });

    // Invalidate relevant cache entries
    queryClient.invalidateQueries(['prompts', { search: searchTerm }]);
  }, [queryClient, trackAnalyticsEvent]);

  // Sort handler
  const handleSort = useCallback((sortBy: 'date' | 'name' | 'usage') => {
    setState(prev => ({
      ...prev,
      sortBy,
      sortOrder: prev.sortBy === sortBy ? (prev.sortOrder === 'asc' ? 'desc' : 'asc') : 'desc'
    }));
  }, []);

  // View mode toggle handler
  const handleViewModeToggle = useCallback(() => {
    setState(prev => ({
      ...prev,
      viewMode: prev.viewMode === 'grid' ? 'list' : 'grid'
    }));
  }, []);

  // Render prompt card
  const renderPromptCard = useCallback((prompt: IPrompt) => (
    <StyledPromptCard elevation={1}>
      <CardContent>
        <Typography variant="h6" noWrap title={prompt.title}>
          {prompt.title}
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
          Last updated: {new Date(prompt.updatedAt).toLocaleDateString()}
        </Typography>
        <Typography variant="body2" noWrap paragraph>
          {prompt.content}
        </Typography>
        <div style={{ display: 'flex', gap: theme.spacing(1), flexWrap: 'wrap' }}>
          <Chip
            size="small"
            label={prompt.status}
            color={prompt.status === PromptStatus.ACTIVE ? 'success' : 'default'}
          />
          {prompt.templateId && (
            <Chip size="small" label="Template" color="primary" variant="outlined" />
          )}
        </div>
      </CardContent>
    </StyledPromptCard>
  ), [theme]);

  // Infinite scroll handler
  const handleInfiniteScroll = useCallback(() => {
    if (inView && !state.isLoading && state.filteredPrompts.length < state.totalCount) {
      setState(prev => ({ ...prev, isLoading: true }));
      // Load next page of prompts
      // Implementation would go here
    }
  }, [inView, state.isLoading, state.filteredPrompts.length, state.totalCount]);

  // Effect for infinite scroll
  useEffect(() => {
    handleInfiniteScroll();
  }, [handleInfiniteScroll]);

  return (
    <ErrorBoundary>
      <StyledContainer>
        <StyledHeader>
          <Typography variant="h4" component="h1">
            Prompt Library
          </Typography>
          <StyledControls>
            <SearchBar
              value={state.searchTerm}
              onSearch={handleSearch}
              placeholder="Search prompts..."
              debounceTime={300}
              isLoading={state.isLoading}
            />
            <Tooltip title="Filter">
              <IconButton>
                <FilterIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Sort">
              <IconButton onClick={() => handleSort(state.sortBy)}>
                <SortIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Toggle view">
              <IconButton onClick={handleViewModeToggle}>
                {state.viewMode === 'grid' ? <ListIcon /> : <GridIcon />}
              </IconButton>
            </Tooltip>
          </StyledControls>
        </StyledHeader>

        {state.isLoading && !state.filteredPrompts.length ? (
          <CircularProgress />
        ) : state.error ? (
          <Typography color="error">{state.error.message}</Typography>
        ) : (
          <VirtualGrid
            data={state.filteredPrompts}
            renderItem={renderPromptCard}
            columnCount={gridConfig.columnCount}
            rowHeight={gridConfig.rowHeight}
            gap={gridConfig.gap}
            overscanCount={gridConfig.overscanCount}
          />
        )}

        <div ref={ref} style={{ height: 20 }}>
          {state.isLoading && state.filteredPrompts.length > 0 && (
            <CircularProgress size={20} />
          )}
        </div>
      </StyledContainer>
    </ErrorBoundary>
  );
};

export default PromptLibrary;