import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { axe } from '@axe-core/react';
import AnalyticsDashboard from '../../../src/components/analytics/AnalyticsDashboard';
import { useAnalytics } from '../../../src/hooks/useAnalytics';
import { MetricType } from '../../../src/interfaces/analytics.interface';

// Mock the useAnalytics hook
jest.mock('../../../src/hooks/useAnalytics');

// Mock date for consistent testing
const mockDate = new Date('2023-01-01T00:00:00Z');
jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

// Test data
const mockMetrics = [
  {
    id: '1',
    type: MetricType.USAGE,
    value: 100,
    timestamp: mockDate,
    metadata: { source: 'test' }
  },
  {
    id: '2',
    type: MetricType.SUCCESS_RATE,
    value: 95.5,
    timestamp: mockDate,
    metadata: { source: 'test' }
  }
];

const mockAggregatedMetrics = {
  totalUsage: 150,
  averageSuccessRate: 89,
  averageResponseTime: 250,
  errorRate: 2.5,
  userSatisfactionScore: 4.5,
  timeRange: {
    startDate: mockDate,
    endDate: mockDate,
    timezone: 'UTC'
  },
  totalTokensUsed: 15000,
  totalCost: 25.50,
  averageIterationsPerPrompt: 2.3,
  teamCollaborationScore: 85,
  trendData: {
    daily: [100, 120, 150],
    weekly: [500, 600, 700],
    monthly: [2000, 2500, 3000]
  }
};

// Helper function to render component with providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    initialState = {},
    store = configureStore({
      reducer: {
        analytics: (state = initialState) => state
      }
    }),
    ...renderOptions
  } = {}
) => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Provider store={store}>
      {children}
    </Provider>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

describe('AnalyticsDashboard Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock implementation
    (useAnalytics as jest.Mock).mockReturnValue({
      metrics: mockMetrics,
      aggregatedMetrics: mockAggregatedMetrics,
      dateRange: {
        startDate: mockDate,
        endDate: mockDate,
        timezone: 'UTC'
      },
      isLoading: false,
      error: null,
      handleDateRangeChange: jest.fn(),
      isSyncing: false
    });
  });

  describe('Rendering and Layout', () => {
    it('renders without crashing with required props', () => {
      renderWithProviders(
        <AnalyticsDashboard 
          workspaceId="test-workspace"
        />
      );
      
      expect(screen.getByRole('region', { name: /analytics dashboard/i })).toBeInTheDocument();
    });

    it('displays correct layout on different screen sizes', () => {
      const { container } = renderWithProviders(
        <AnalyticsDashboard 
          workspaceId="test-workspace"
        />
      );

      // Test mobile layout
      window.innerWidth = 375;
      fireEvent(window, new Event('resize'));
      expect(container.querySelector('.MuiGrid-grid-xs-12')).toBeInTheDocument();

      // Test desktop layout
      window.innerWidth = 1200;
      fireEvent(window, new Event('resize'));
      expect(container.querySelector('.MuiGrid-grid-md-3')).toBeInTheDocument();
    });

    it('maintains accessibility standards', async () => {
      const { container } = renderWithProviders(
        <AnalyticsDashboard 
          workspaceId="test-workspace"
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('handles loading states correctly', () => {
      (useAnalytics as jest.Mock).mockReturnValue({
        ...useAnalytics(),
        isLoading: true
      });

      renderWithProviders(
        <AnalyticsDashboard 
          workspaceId="test-workspace"
        />
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('displays error states appropriately', () => {
      const errorMessage = 'Failed to load analytics';
      (useAnalytics as jest.Mock).mockReturnValue({
        ...useAnalytics(),
        error: new Error(errorMessage)
      });

      renderWithProviders(
        <AnalyticsDashboard 
          workspaceId="test-workspace"
        />
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('Metrics Functionality', () => {
    it('displays correct initial metrics data', () => {
      renderWithProviders(
        <AnalyticsDashboard 
          workspaceId="test-workspace"
        />
      );

      expect(screen.getByText('150')).toBeInTheDocument(); // Total Usage
      expect(screen.getByText('89%')).toBeInTheDocument(); // Success Rate
      expect(screen.getByText('250ms')).toBeInTheDocument(); // Response Time
      expect(screen.getByText('$25.50')).toBeInTheDocument(); // Cost
    });

    it('updates metrics on date range change', async () => {
      const handleDateRangeChange = jest.fn();
      (useAnalytics as jest.Mock).mockReturnValue({
        ...useAnalytics(),
        handleDateRangeChange
      });

      renderWithProviders(
        <AnalyticsDashboard 
          workspaceId="test-workspace"
        />
      );

      const datePicker = screen.getByRole('textbox', { name: /start date/i });
      fireEvent.change(datePicker, { target: { value: '2023-02-01' } });

      await waitFor(() => {
        expect(handleDateRangeChange).toHaveBeenCalledWith(expect.objectContaining({
          startDate: expect.any(Date)
        }));
      });
    });

    it('handles real-time updates correctly', async () => {
      const { rerender } = renderWithProviders(
        <AnalyticsDashboard 
          workspaceId="test-workspace"
        />
      );

      // Simulate real-time update
      (useAnalytics as jest.Mock).mockReturnValue({
        ...useAnalytics(),
        aggregatedMetrics: {
          ...mockAggregatedMetrics,
          totalUsage: 200
        },
        isSyncing: true
      });

      rerender(
        <AnalyticsDashboard 
          workspaceId="test-workspace"
        />
      );

      expect(screen.getByText('200')).toBeInTheDocument();
      expect(screen.getByLabelText('syncing')).toBeInTheDocument();
    });
  });

  describe('Chart Interactions', () => {
    it('renders charts with correct data', () => {
      renderWithProviders(
        <AnalyticsDashboard 
          workspaceId="test-workspace"
        />
      );

      expect(screen.getByText('Usage Over Time')).toBeInTheDocument();
      expect(screen.getByText('Success Rate Trend')).toBeInTheDocument();
      expect(screen.getByText('Response Time Distribution')).toBeInTheDocument();
    });

    it('supports chart export functionality', async () => {
      renderWithProviders(
        <AnalyticsDashboard 
          workspaceId="test-workspace"
        />
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export CSV')).toBeInTheDocument();
        expect(screen.getByText('Export PNG')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', () => {
      const onError = jest.fn();
      const error = new Error('API Error');
      
      (useAnalytics as jest.Mock).mockReturnValue({
        ...useAnalytics(),
        error
      });

      renderWithProviders(
        <AnalyticsDashboard 
          workspaceId="test-workspace"
          onError={onError}
        />
      );

      expect(onError).toHaveBeenCalledWith(error);
      expect(screen.getByText(/failed to load analytics/i)).toBeInTheDocument();
    });

    it('supports retry functionality', async () => {
      const handleDateRangeChange = jest.fn();
      (useAnalytics as jest.Mock).mockReturnValue({
        ...useAnalytics(),
        error: new Error('API Error'),
        handleDateRangeChange
      });

      renderWithProviders(
        <AnalyticsDashboard 
          workspaceId="test-workspace"
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      expect(handleDateRangeChange).toHaveBeenCalled();
    });
  });
});