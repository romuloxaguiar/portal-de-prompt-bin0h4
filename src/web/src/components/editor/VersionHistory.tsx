import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { format } from 'date-fns';
import Table from '../common/Table';
import { useAnalytics } from '../../hooks/useAnalytics';
import { IPromptVersion } from '../../store/prompt/prompt.types';
import { ErrorCode } from '../../constants/error.constant';

// Styled components
const StyledVersionHistory = styled.div`
  width: 100%;
  height: 100%;
  padding: ${({ theme }) => theme.spacing(2)}px;
  background-color: ${({ theme }) => theme.palette.background.paper};
  position: relative;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.spacing(1)}px;
`;

const StyledLoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const StyledDiffView = styled.div`
  margin-top: ${({ theme }) => theme.spacing(2)}px;
  padding: ${({ theme }) => theme.spacing(2)}px;
  background-color: ${({ theme }) => theme.palette.background.default};
  border-radius: ${({ theme }) => theme.spacing(1)}px;
  border: 1px solid ${({ theme }) => theme.palette.divider};
`;

// Props interface
interface VersionHistoryProps {
  promptId: string;
  onVersionSelect: (version: IPromptVersion) => void;
  onError: (error: { code: ErrorCode; message: string }) => void;
}

const VersionHistory: React.FC<VersionHistoryProps> = React.memo(({
  promptId,
  onVersionSelect,
  onError
}) => {
  // State
  const [versions, setVersions] = useState<IPromptVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<IPromptVersion | null>(null);
  const [loading, setLoading] = useState(false);

  // Analytics hook
  const { trackAnalyticsEvent } = useAnalytics();

  // Fetch versions on mount
  useEffect(() => {
    const fetchVersions = async () => {
      try {
        setLoading(true);
        // API call would go here to fetch versions
        // For now using mock data
        const mockVersions: IPromptVersion[] = [];
        setVersions(mockVersions);
      } catch (error) {
        onError({
          code: ErrorCode.NOT_FOUND_ERROR,
          message: 'Failed to fetch version history'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchVersions();
  }, [promptId, onError]);

  // Table columns configuration
  const columns = useMemo(() => [
    {
      id: 'version',
      label: 'Version',
      accessor: 'version',
      width: '100px',
      align: 'center'
    },
    {
      id: 'createdAt',
      label: 'Created',
      accessor: 'createdAt',
      width: '200px',
      render: (value: Date) => format(value, 'MMM dd, yyyy HH:mm')
    },
    {
      id: 'changes',
      label: 'Changes',
      accessor: 'changes.description'
    },
    {
      id: 'author',
      label: 'Author',
      accessor: 'changes.author',
      width: '150px'
    }
  ], []);

  // Handle version selection
  const handleVersionSelect = useCallback((version: IPromptVersion) => {
    setSelectedVersion(version);
    onVersionSelect(version);

    // Track version selection event
    trackAnalyticsEvent({
      type: 'prompt_version_selected',
      promptId,
      data: {
        versionId: version.id,
        versionNumber: version.version
      }
    });
  }, [promptId, onVersionSelect, trackAnalyticsEvent]);

  // Handle version restore
  const handleVersionRestore = useCallback(async (version: IPromptVersion) => {
    try {
      setLoading(true);
      // API call would go here to restore version
      
      trackAnalyticsEvent({
        type: 'prompt_version_restored',
        promptId,
        data: {
          versionId: version.id,
          versionNumber: version.version
        }
      });

      onVersionSelect(version);
    } catch (error) {
      onError({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Failed to restore version'
      });
    } finally {
      setLoading(false);
    }
  }, [promptId, onVersionSelect, trackAnalyticsEvent, onError]);

  return (
    <StyledVersionHistory>
      {loading && (
        <StyledLoadingOverlay>
          Loading version history...
        </StyledLoadingOverlay>
      )}

      <Table
        data={versions}
        columns={columns}
        loading={loading}
        pagination
        pageSize={10}
        sortable
        ariaLabel="Version history table"
      />

      {selectedVersion && (
        <StyledDiffView>
          <h4>Version {selectedVersion.version} Changes</h4>
          <p>{selectedVersion.changes.description}</p>
          <Button
            onClick={() => handleVersionRestore(selectedVersion)}
            disabled={loading}
            aria-label={`Restore version ${selectedVersion.version}`}
          >
            Restore This Version
          </Button>
        </StyledDiffView>
      )}
    </StyledVersionHistory>
  );
});

VersionHistory.displayName = 'VersionHistory';

export default VersionHistory;