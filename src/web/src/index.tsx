import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

import App from './App';
import { store } from './store/store';
import GlobalStyles from './styles/global.styles';
import { useTheme } from './hooks/useTheme';
import { analyticsService } from './services/analytics.service';
import { storage } from './utils/storage.util';

// Initialize analytics and storage
const initializeServices = async () => {
  try {
    await storage.initializeStorage();
    await analyticsService.initialize();
  } catch (error) {
    console.error('Failed to initialize services:', error);
  }
};

// Error Fallback component with retry capability
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div
    role="alert"
    style={{
      padding: '20px',
      margin: '20px',
      border: '1px solid #ff0000',
      borderRadius: '4px',
      backgroundColor: '#fff5f5'
    }}
  >
    <h2>Something went wrong</h2>
    <pre style={{ whiteSpace: 'pre-wrap' }}>{error.message}</pre>
    <button
      onClick={resetErrorBoundary}
      style={{
        padding: '8px 16px',
        marginTop: '16px',
        backgroundColor: '#0066cc',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      Try again
    </button>
  </div>
);

// Root component with theme provider
const Root = () => {
  const { theme } = useTheme();

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => window.location.reload()}
        onError={(error) => {
          console.error('Application Error:', error);
          analyticsService.trackMetric({
            type: 'ERROR_RATE',
            value: 1,
            metadata: {
              error: error.message,
              stack: error.stack
            }
          });
        }}
      >
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  );
};

// Initialize root render with strict mode
const renderApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Create React root
  const root = ReactDOM.createRoot(rootElement);

  // Initialize services before rendering
  initializeServices().then(() => {
    root.render(
      <React.StrictMode>
        <Provider store={store}>
          <Root />
        </Provider>
      </React.StrictMode>
    );
  });

  // Register service worker for PWA support
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch((error) => {
        console.error('Service worker registration failed:', error);
      });
    });
  }

  // Performance monitoring
  if (process.env.NODE_ENV === 'production') {
    import('web-vitals').then(({ getCLS, getFID, getLCP }) => {
      getCLS((metric) => {
        analyticsService.trackMetric({
          type: 'PERFORMANCE',
          value: metric.value,
          metadata: { metric: 'CLS' }
        });
      });
      getFID((metric) => {
        analyticsService.trackMetric({
          type: 'PERFORMANCE',
          value: metric.value,
          metadata: { metric: 'FID' }
        });
      });
      getLCP((metric) => {
        analyticsService.trackMetric({
          type: 'PERFORMANCE',
          value: metric.value,
          metadata: { metric: 'LCP' }
        });
      });
    });
  }
};

// Start the application
renderApp();

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', renderApp);
}

// Export store types for type safety
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;