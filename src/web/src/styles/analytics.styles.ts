import styled, { css } from 'styled-components'; // v5.3.0
import { calculateResponsiveSpacing } from './theme.styles';

// Breakpoint constants
const BREAKPOINTS = {
  xs: '320px',
  sm: '768px',
  md: '1024px',
  lg: '1440px'
} as const;

// Grid layout constants
const GRID_COLUMNS = {
  xs: 1,
  sm: 2,
  md: 3,
  lg: 4
} as const;

// Chart aspect ratio constants
const CHART_RATIOS = {
  default: '16/9',
  mobile: '4/3'
} as const;

// Shared styles
const cardStyles = css`
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-radius: ${({ theme }) => theme.spacing(1)}px;
  padding: ${({ theme }) => theme.spacing(2)}px;
  transition: all ${({ theme }) => theme.transitions.duration.standard}ms ${({ theme }) => theme.transitions.easing.easeInOut};
  
  &:hover {
    box-shadow: ${({ theme }) => theme.shadows[4]};
  }
`;

// Main dashboard container
export const DashboardContainer = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(3)}px;
  padding: ${({ theme }) => theme.spacing(2)}px;
  width: 100%;
  min-height: 100%;
  background-color: ${({ theme }) => theme.palette.background.default};

  @media (min-width: ${BREAKPOINTS.sm}) {
    grid-template-columns: repeat(${GRID_COLUMNS.sm}, 1fr);
    padding: ${({ theme }) => theme.spacing(3)}px;
  }

  @media (min-width: ${BREAKPOINTS.md}) {
    grid-template-columns: repeat(${GRID_COLUMNS.md}, 1fr);
    padding: ${({ theme }) => theme.spacing(4)}px;
  }

  @media (min-width: ${BREAKPOINTS.lg}) {
    grid-template-columns: repeat(${GRID_COLUMNS.lg}, 1fr);
  }
`;

// Metrics card container
export const MetricsCardContainer = styled.article`
  ${cardStyles}
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)}px;
  min-height: 160px;

  h3 {
    color: ${({ theme }) => theme.palette.text.primary};
    font-size: ${({ theme }) => theme.typography.h5.fontSize};
    font-weight: ${({ theme }) => theme.typography.fontWeights.medium};
    margin: 0;
  }

  .metric-value {
    color: ${({ theme }) => theme.palette.primary.main};
    font-size: ${({ theme }) => theme.typography.h4.fontSize};
    font-weight: ${({ theme }) => theme.typography.fontWeights.bold};
  }

  .metric-label {
    color: ${({ theme }) => theme.palette.text.secondary};
    font-size: ${({ theme }) => theme.typography.body2.fontSize};
  }
`;

// Chart container with responsive aspect ratio
export const ChartContainer = styled.div`
  ${cardStyles}
  grid-column: 1 / -1;
  aspect-ratio: ${CHART_RATIOS.default};
  width: 100%;
  overflow: hidden;

  @media (max-width: ${BREAKPOINTS.sm}) {
    aspect-ratio: ${CHART_RATIOS.mobile};
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${({ theme }) => theme.spacing(2)}px;
  }

  .chart-content {
    height: calc(100% - ${({ theme }) => theme.spacing(6)}px);
    width: 100%;
  }
`;

// Stats container with responsive grid
export const StatsContainer = styled.section`
  display: grid;
  gap: ${({ theme }) => theme.spacing(2)}px;
  grid-template-columns: 1fr;
  width: 100%;

  @media (min-width: ${BREAKPOINTS.sm}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: ${BREAKPOINTS.md}) {
    grid-template-columns: repeat(3, 1fr);
  }

  .stat-item {
    ${cardStyles}
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing(1)}px;
    padding: ${({ theme }) => theme.spacing(2)}px;
  }
`;

// Usage statistics table container
export const UsageTableContainer = styled.div`
  ${cardStyles}
  grid-column: 1 / -1;
  overflow: hidden;
  
  .table-header {
    position: sticky;
    top: 0;
    background-color: ${({ theme }) => theme.palette.background.paper};
    border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
    z-index: 1;
  }

  .table-cell {
    padding: ${({ theme }) => theme.spacing(1.5)}px;
    font-size: ${({ theme }) => theme.typography.body2.fontSize};
  }
`;

// Loading state container
export const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  width: 100%;
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-radius: ${({ theme }) => theme.spacing(1)}px;
`;

// Error state container
export const ErrorContainer = styled.div`
  ${cardStyles}
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(2)}px;
  padding: ${({ theme }) => theme.spacing(4)}px;
  text-align: center;
  color: ${({ theme }) => theme.palette.error.main};
`;