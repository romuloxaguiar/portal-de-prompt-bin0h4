import dayjs from 'dayjs'; // ^1.11.9
import utc from 'dayjs/plugin/utc'; // ^1.11.9
import timezone from 'dayjs/plugin/timezone'; // ^1.11.9
import duration from 'dayjs/plugin/duration'; // ^1.11.9

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);

// Constants for date formatting and validation
export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  DISPLAY: 'MMMM D, YYYY',
  SHORT: 'MM/DD/YYYY',
  TIME: 'HH:mm:ss',
  ANALYTICS: 'YYYY-MM-DD',
  TIMESTAMP: 'X',
  TIMEZONE: 'z'
} as const;

export const MAX_DATE_RANGE_DAYS = 365;
export const CACHE_TTL = 3600; // Cache TTL in seconds

// Type definitions
export interface IDateRange {
  startDate: Date;
  endDate: Date;
  timezone?: string;
}

export interface IDateRangeOptions {
  timezone?: string;
  includeTime?: boolean;
  customOffset?: number;
}

export interface IValidationOptions {
  maxRangeDays?: number;
  requireTimezone?: boolean;
  customValidation?: (range: IDateRange) => boolean;
}

export interface ITimestampOptions {
  format?: keyof typeof DATE_FORMATS;
  timezone?: string;
  precision?: 'seconds' | 'milliseconds';
}

export interface IDurationOptions {
  format?: string;
  locale?: string;
  humanize?: boolean;
}

// Error classes
export class DateParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DateParseError';
  }
}

// Cache implementation for date range calculations
const dateRangeCache = new Map<string, { value: IDateRange; timestamp: number }>();

/**
 * Formats a date according to specified format with timezone support
 * @param date - Date to format
 * @param format - Format string or key from DATE_FORMATS
 * @param timezone - Optional timezone
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string | number,
  format: keyof typeof DATE_FORMATS | string,
  timezone?: string
): string => {
  try {
    if (!date) {
      throw new DateParseError('Invalid date input');
    }

    const formatString = DATE_FORMATS[format as keyof typeof DATE_FORMATS] || format;
    let dateObj = dayjs.utc(date);

    if (timezone) {
      dateObj = dateObj.tz(timezone);
    }

    const formatted = dateObj.format(formatString);
    if (formatted === 'Invalid Date') {
      throw new DateParseError('Invalid date format');
    }

    return formatted;
  } catch (error) {
    throw new DateParseError(`Error formatting date: ${error.message}`);
  }
};

/**
 * Safely parses a date string into a standardized Date object
 * @param dateString - Date string to parse
 * @param format - Optional format string
 * @returns Parsed Date object
 */
export const parseDate = (dateString: string, format?: string): Date => {
  try {
    const parsed = format
      ? dayjs.utc(dateString, format)
      : dayjs.utc(dateString);

    if (!parsed.isValid()) {
      throw new DateParseError('Invalid date string');
    }

    return parsed.toDate();
  } catch (error) {
    throw new DateParseError(`Error parsing date: ${error.message}`);
  }
};

/**
 * Calculates start and end dates for analytics periods with caching
 * @param period - Period identifier (e.g., 'day', 'week', 'month', 'year')
 * @param options - Configuration options
 * @returns Date range object
 */
export const calculateDateRange = (
  period: string,
  options: IDateRangeOptions = {}
): IDateRange => {
  const cacheKey = `${period}-${JSON.stringify(options)}`;
  const cached = dateRangeCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
    return cached.value;
  }

  const now = dayjs.utc();
  let startDate: dayjs.Dayjs;

  switch (period.toLowerCase()) {
    case 'day':
      startDate = now.startOf('day');
      break;
    case 'week':
      startDate = now.startOf('week');
      break;
    case 'month':
      startDate = now.startOf('month');
      break;
    case 'year':
      startDate = now.startOf('year');
      break;
    default:
      throw new Error('Invalid period specified');
  }

  if (options.customOffset) {
    startDate = startDate.subtract(options.customOffset, period);
  }

  const dateRange: IDateRange = {
    startDate: startDate.toDate(),
    endDate: now.toDate(),
    timezone: options.timezone
  };

  dateRangeCache.set(cacheKey, {
    value: dateRange,
    timestamp: Date.now()
  });

  return dateRange;
};

/**
 * Validates date range against business rules
 * @param dateRange - Date range to validate
 * @param options - Validation options
 * @returns Validation result
 */
export const isValidDateRange = (
  dateRange: IDateRange,
  options: IValidationOptions = {}
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const maxDays = options.maxRangeDays || MAX_DATE_RANGE_DAYS;

  if (!dateRange.startDate || !dateRange.endDate) {
    errors.push('Date range must include both start and end dates');
  }

  if (dayjs(dateRange.endDate).isBefore(dateRange.startDate)) {
    errors.push('End date must be after start date');
  }

  const daysDiff = dayjs(dateRange.endDate).diff(dateRange.startDate, 'days');
  if (daysDiff > maxDays) {
    errors.push(`Date range cannot exceed ${maxDays} days`);
  }

  if (options.requireTimezone && !dateRange.timezone) {
    errors.push('Timezone is required');
  }

  if (options.customValidation && !options.customValidation(dateRange)) {
    errors.push('Custom validation failed');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Gets current timestamp with high precision
 * @param options - Timestamp configuration options
 * @returns Formatted timestamp
 */
export const getTimestamp = (options: ITimestampOptions = {}): string | number => {
  const now = dayjs.utc();
  
  if (options.timezone) {
    now.tz(options.timezone);
  }

  if (options.format) {
    return now.format(DATE_FORMATS[options.format]);
  }

  return options.precision === 'seconds' 
    ? Math.floor(now.valueOf() / 1000)
    : now.valueOf();
};

/**
 * Formats time duration with localization support
 * @param startDate - Start date
 * @param endDate - End date
 * @param options - Formatting options
 * @returns Formatted duration string
 */
export const formatDuration = (
  startDate: Date | string | number,
  endDate: Date | string | number,
  options: IDurationOptions = {}
): string => {
  try {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    
    if (!start.isValid() || !end.isValid()) {
      throw new DateParseError('Invalid date input');
    }

    const diff = dayjs.duration(end.diff(start));

    if (options.humanize) {
      return diff.humanize(options.locale);
    }

    const format = options.format || 'D[d] H[h] m[m]';
    return diff.format(format);
  } catch (error) {
    throw new DateParseError(`Error formatting duration: ${error.message}`);
  }
};