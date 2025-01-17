import React, { useMemo, memo } from 'react';
import { TrendingUp, TrendingDown } from '@mui/icons-material'; // v5.0.0
import Card from '../common/Card';
import { MetricType } from '../../interfaces/analytics.interface';
import { MetricsCardContainer } from '../../styles/analytics.styles';

interface MetricsCardProps {
  title: string;
  type: MetricType;
  value: number;
  previousValue?: number;
  unit?: string;
  onClick?: (event: React.MouseEvent) => void;
  highContrast?: boolean;
  locale?: string;
}

const formatValue = (value: number, type: MetricType, unit?: string, locale = 'en-US'): string => {
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });

  let formattedValue = formatter.format(value);

  switch (type) {
    case MetricType.SUCCESS_RATE:
    case MetricType.ERROR_RATE:
    case MetricType.USER_SATISFACTION:
      formattedValue = `${formattedValue}%`;
      break;
    case MetricType.RESPONSE_TIME:
      formattedValue = `${formattedValue}ms`;
      break;
    case MetricType.COST_PER_PROMPT:
      formattedValue = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD'
      }).format(value);
      break;
    default:
      if (unit) {
        formattedValue = `${formattedValue}${unit}`;
      }
  }

  return formattedValue;
};

const calculateTrend = (currentValue: number, previousValue?: number) => {
  if (!previousValue) return null;

  const percentageChange = ((currentValue - previousValue) / previousValue) * 100;
  const isPositive = percentageChange >= 0;
  const description = `${isPositive ? 'Increased' : 'Decreased'} by ${Math.abs(percentageChange).toFixed(1)}%`;

  return {
    percentage: percentageChange,
    isPositive,
    description
  };
};

const MetricsCard: React.FC<MetricsCardProps> = memo(({
  title,
  type,
  value,
  previousValue,
  unit,
  onClick,
  highContrast = false,
  locale = 'en-US'
}) => {
  const formattedValue = useMemo(() => 
    formatValue(value, type, unit, locale),
    [value, type, unit, locale]
  );

  const trend = useMemo(() => 
    calculateTrend(value, previousValue),
    [value, previousValue]
  );

  const trendColor = trend?.isPositive ? 'success.main' : 'error.main';
  const trendIcon = trend?.isPositive ? <TrendingUp /> : <TrendingDown />;

  return (
    <Card
      elevation={1}
      clickable={!!onClick}
      onClick={onClick}
      highContrast={highContrast}
      ariaLabel={`${title} metric card showing ${formattedValue}${trend ? `, ${trend.description}` : ''}`}
    >
      <MetricsCardContainer>
        <h3>{title}</h3>
        <div className="metric-value" role="text">
          {formattedValue}
        </div>
        {trend && (
          <div 
            className="metric-trend"
            role="status"
            aria-label={trend.description}
            style={{ 
              color: highContrast ? (trend.isPositive ? '#000000' : '#FFFFFF') : trendColor,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.875rem'
            }}
          >
            {trendIcon}
            <span>{Math.abs(trend.percentage).toFixed(1)}%</span>
          </div>
        )}
      </MetricsCardContainer>
    </Card>
  );
});

MetricsCard.displayName = 'MetricsCard';

export default MetricsCard;