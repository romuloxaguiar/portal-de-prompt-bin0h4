import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/common/Button';
import { ROUTES } from '../constants/routes.constant';

// Styled components with Material Design principles and accessibility
const NotFoundContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  padding: ${({ theme }) => theme.spacing(3)}px;
  margin: 0 auto;
  max-width: 600px;

  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    padding: ${({ theme }) => theme.spacing(2)}px;
    min-height: 50vh;
  }
`;

const ErrorCode = styled.h1`
  font-size: clamp(64px, 10vw, 96px);
  font-weight: ${({ theme }) => theme.typography.fontWeights.bold};
  color: ${({ theme }) => theme.palette.error.main};
  margin-bottom: ${({ theme }) => theme.spacing(2)}px;
  animation: fadeIn 0.5s ease-in-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const ErrorMessage = styled.p`
  font-size: clamp(18px, 4vw, 24px);
  color: ${({ theme }) => theme.palette.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing(4)}px;
  line-height: 1.5;

  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    margin-bottom: ${({ theme }) => theme.spacing(3)}px;
  }
`;

const ReturnButton = styled(Button)`
  margin-top: ${({ theme }) => theme.spacing(3)}px;
  min-width: 200px;
  min-height: 48px;

  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    width: 100%;
  }
`;

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  // Update document title and track 404 error
  useEffect(() => {
    document.title = '404 - Page Not Found | Prompts Portal';
    
    // Track 404 error in analytics
    const trackNotFoundError = async () => {
      try {
        await window.gtag?.('event', 'page_view', {
          page_title: '404 Not Found',
          page_location: window.location.href,
          page_path: window.location.pathname,
          send_to: window.gtag?.('get', 'G-XXXXXXXX')
        });
      } catch (error) {
        console.error('Analytics error:', error);
      }
    };

    trackNotFoundError();
  }, []);

  // Handle return to dashboard
  const handleReturn = () => {
    navigate(ROUTES.DASHBOARD);
  };

  return (
    <AppLayout>
      <NotFoundContainer role="main" aria-labelledby="error-title">
        <ErrorCode id="error-title" aria-label="Error 404">
          404
        </ErrorCode>
        <ErrorMessage>
          Oops! The page you're looking for doesn't exist or has been moved.
        </ErrorMessage>
        <ReturnButton
          variant="contained"
          size="large"
          onClick={handleReturn}
          aria-label="Return to dashboard"
          startIcon="🏠"
        >
          Return to Dashboard
        </ReturnButton>
      </NotFoundContainer>
    </AppLayout>
  );
};

export default NotFound;