import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useTheme } from '../../hooks/useTheme';
import Pagination from './Pagination';
import Loading from './Loading';

// Column definition interface
interface ColumnDefinition {
  id: string;
  label: string;
  accessor: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: any) => React.ReactNode;
}

// Table props interface
interface TableProps {
  data: Array<Record<string, any>>;
  columns: ColumnDefinition[];
  loading?: boolean;
  pagination?: boolean;
  pageSize?: number;
  sortable?: boolean;
  highContrast?: boolean;
  ariaLabel?: string;
}

// Styled components following Material Design 3.0
const StyledTableContainer = styled.div<{ $highContrast?: boolean }>`
  width: 100%;
  overflow-x: auto;
  border-radius: 4px;
  box-shadow: ${({ theme }) => theme.shadows[1]};
  position: relative;
  min-height: 200px;
  background: ${({ theme }) => theme.palette.background.paper};
  border: ${({ $highContrast }) => $highContrast ? '2px solid currentColor' : 'none'};

  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    border-radius: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
`;

const StyledThead = styled.thead<{ $highContrast?: boolean }>`
  background: ${({ theme, $highContrast }) => 
    $highContrast ? theme.palette.grey[900] : theme.palette.grey[100]};
`;

const StyledTh = styled.th<{ $sortable?: boolean; $align?: string; $width?: string }>`
  padding: ${({ theme }) => theme.spacing(2)}px;
  text-align: ${({ $align }) => $align || 'left'};
  font-weight: ${({ theme }) => theme.typography.fontWeights.medium};
  color: ${({ theme }) => theme.palette.text.primary};
  width: ${({ $width }) => $width || 'auto'};
  cursor: ${({ $sortable }) => $sortable ? 'pointer' : 'default'};
  user-select: none;
  white-space: nowrap;
  
  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.palette.primary.main};
    outline-offset: -3px;
  }
`;

const StyledTr = styled.tr<{ $highContrast?: boolean }>`
  &:nth-child(even) {
    background: ${({ theme, $highContrast }) => 
      $highContrast ? 'rgba(255, 255, 255, 0.05)' : theme.palette.grey[50]};
  }

  &:hover {
    background: ${({ theme, $highContrast }) => 
      $highContrast ? 'rgba(255, 255, 255, 0.1)' : theme.palette.action.hover};
  }
`;

const StyledTd = styled.td<{ $align?: string }>`
  padding: ${({ theme }) => theme.spacing(2)}px;
  text-align: ${({ $align }) => $align || 'left'};
  color: ${({ theme }) => theme.palette.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Table: React.FC<TableProps> = React.memo(({
  data,
  columns,
  loading = false,
  pagination = true,
  pageSize = 10,
  sortable = false,
  highContrast = false,
  ariaLabel = 'Data table'
}) => {
  const { theme } = useTheme();
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Sort data when sort configuration changes
  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  // Calculate pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Handle sort
  const handleSort = useCallback((columnId: string) => {
    if (!sortable) return;

    setSortConfig(current => {
      if (!current || current.key !== columnId) {
        return { key: columnId, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key: columnId, direction: 'desc' };
      }
      return null;
    });
  }, [sortable]);

  // Handle keyboard navigation for sortable headers
  const handleKeyDown = useCallback((e: React.KeyboardEvent, columnId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSort(columnId);
    }
  }, [handleSort]);

  // Reset pagination when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  return (
    <StyledTableContainer 
      $highContrast={highContrast}
      role="region"
      aria-label={ariaLabel}
    >
      {loading && (
        <Loading 
          size="large"
          overlay
          ariaLabel="Loading table data"
        />
      )}
      
      <StyledTable role="table">
        <StyledThead $highContrast={highContrast}>
          <tr>
            {columns.map(column => (
              <StyledTh
                key={column.id}
                $sortable={sortable && column.sortable}
                $align={column.align}
                $width={column.width}
                onClick={() => column.sortable && handleSort(column.accessor)}
                onKeyDown={(e) => column.sortable && handleKeyDown(e, column.accessor)}
                tabIndex={column.sortable ? 0 : -1}
                role={column.sortable ? 'columnheader button' : 'columnheader'}
                aria-sort={
                  sortConfig?.key === column.accessor
                    ? sortConfig.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                {column.label}
                {sortable && column.sortable && sortConfig?.key === column.accessor && (
                  <span aria-hidden="true">
                    {sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                  </span>
                )}
              </StyledTh>
            ))}
          </tr>
        </StyledThead>
        
        <tbody>
          {paginatedData.map((row, rowIndex) => (
            <StyledTr 
              key={rowIndex}
              $highContrast={highContrast}
              role="row"
            >
              {columns.map(column => (
                <StyledTd
                  key={column.id}
                  $align={column.align}
                  role="cell"
                >
                  {column.render
                    ? column.render(row[column.accessor], row)
                    : row[column.accessor]}
                </StyledTd>
              ))}
            </StyledTr>
          ))}
        </tbody>
      </StyledTable>

      {pagination && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          highContrast={highContrast}
          ariaLabels={{
            next: 'Next page of results',
            previous: 'Previous page of results',
            first: 'First page of results',
            last: 'Last page of results',
            page: 'Page'
          }}
        />
      )}
    </StyledTableContainer>
  );
});

Table.displayName = 'Table';

export default Table;