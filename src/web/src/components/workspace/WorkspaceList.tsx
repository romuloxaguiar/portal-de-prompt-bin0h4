import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    IconButton,
    TextField,
    CircularProgress,
    Alert,
    Chip,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    useTheme,
    useMediaQuery
} from '@mui/material'; // ^5.0.0
import {
    Add as AddIcon,
    MoreVert as MoreVertIcon,
    Search as SearchIcon,
    ViewModule as GridViewIcon,
    ViewList as ListViewIcon,
    Sort as SortIcon
} from '@mui/icons-material'; // ^5.0.0
import debounce from 'lodash/debounce'; // ^4.17.0

import { Workspace } from '../../interfaces/workspace.interface';
import { WorkspaceService } from '../../services/workspace.service';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useErrorBoundary } from 'react-error-boundary';

interface WorkspaceListProps {
    teamId?: string;
    onWorkspaceSelect: (workspace: Workspace) => void;
    viewMode: 'grid' | 'list';
    sortBy: 'name' | 'lastActivity' | 'members';
}

const WorkspaceList: React.FC<WorkspaceListProps> = ({
    teamId,
    onWorkspaceSelect,
    viewMode = 'grid',
    sortBy = 'lastActivity'
}) => {
    // State management
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
    const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');

    // Hooks
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const { showBoundary } = useErrorBoundary();
    const workspaceService = useMemo(() => new WorkspaceService(), []);

    // WebSocket setup for real-time updates
    const { subscribe, unsubscribe } = useWebSocket(
        `${process.env.REACT_APP_WS_URL}/workspaces`,
        { batchMessages: true }
    );

    // Fetch workspaces with error handling
    const fetchWorkspaces = useCallback(async () => {
        try {
            setLoading(true);
            const response = await workspaceService.getWorkspaces();
            setWorkspaces(response.data);
        } catch (error) {
            showBoundary(error);
        } finally {
            setLoading(false);
        }
    }, [workspaceService, showBoundary]);

    // Real-time workspace updates
    useEffect(() => {
        const handleWorkspaceUpdate = (update: any) => {
            setWorkspaces(prevWorkspaces => {
                const updatedWorkspaces = [...prevWorkspaces];
                const index = updatedWorkspaces.findIndex(w => w.id === update.id);
                
                if (index !== -1) {
                    updatedWorkspaces[index] = { ...updatedWorkspaces[index], ...update };
                } else {
                    updatedWorkspaces.push(update);
                }
                
                return updatedWorkspaces;
            });
        };

        subscribe('workspace_update', handleWorkspaceUpdate);
        return () => unsubscribe('workspace_update');
    }, [subscribe, unsubscribe]);

    // Initial data fetch
    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    // Debounced search handler
    const handleSearch = debounce((query: string) => {
        setSearchQuery(query);
    }, 300);

    // Sort workspaces based on criteria
    const sortedWorkspaces = useMemo(() => {
        return [...workspaces].sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'lastActivity':
                    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
                case 'members':
                    return b.members.length - a.members.length;
                default:
                    return 0;
            }
        });
    }, [workspaces, sortBy]);

    // Filtered workspaces based on search
    const filteredWorkspaces = useMemo(() => {
        return sortedWorkspaces.filter(workspace =>
            workspace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            workspace.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [sortedWorkspaces, searchQuery]);

    // Workspace creation handler
    const handleCreateWorkspace = async () => {
        try {
            await workspaceService.createWorkspace({
                name: newWorkspaceName,
                description: newWorkspaceDescription,
                teamId: teamId || '',
                settings: {
                    isPublic: false,
                    allowComments: true,
                    autoSave: true,
                    realTimeCollaboration: true,
                    versionHistory: true
                }
            });
            setCreateDialogOpen(false);
            setNewWorkspaceName('');
            setNewWorkspaceDescription('');
            fetchWorkspaces();
        } catch (error) {
            showBoundary(error);
        }
    };

    // Workspace deletion handler
    const handleDeleteWorkspace = async (workspace: Workspace) => {
        if (window.confirm(`Are you sure you want to delete "${workspace.name}"?`)) {
            try {
                await workspaceService.deleteWorkspace(workspace.id);
                setWorkspaces(prevWorkspaces => 
                    prevWorkspaces.filter(w => w.id !== workspace.id)
                );
            } catch (error) {
                showBoundary(error);
            }
        }
    };

    // Render loading state
    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>
            {/* Search and controls */}
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search workspaces..."
                    InputProps={{
                        startAdornment: <SearchIcon color="action" />,
                    }}
                    onChange={(e) => handleSearch(e.target.value)}
                />
                <IconButton
                    onClick={() => setCreateDialogOpen(true)}
                    aria-label="Create workspace"
                >
                    <AddIcon />
                </IconButton>
            </Box>

            {/* Workspace grid/list */}
            <Grid container spacing={2}>
                {filteredWorkspaces.map(workspace => (
                    <Grid item xs={12} sm={viewMode === 'grid' ? 6 : 12} md={viewMode === 'grid' ? 4 : 12} key={workspace.id}>
                        <Card
                            sx={{
                                height: '100%',
                                cursor: 'pointer',
                                '&:hover': { boxShadow: 6 }
                            }}
                            onClick={() => onWorkspaceSelect(workspace)}
                        >
                            <CardContent>
                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <Typography variant="h6" component="h2">
                                        {workspace.name}
                                    </Typography>
                                    <IconButton
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedWorkspace(workspace);
                                            setAnchorEl(e.currentTarget);
                                        }}
                                    >
                                        <MoreVertIcon />
                                    </IconButton>
                                </Box>
                                <Typography color="textSecondary" gutterBottom>
                                    {workspace.description}
                                </Typography>
                                <Box display="flex" gap={1} mt={1}>
                                    <Chip
                                        size="small"
                                        label={`${workspace.members.length} members`}
                                    />
                                    <Chip
                                        size="small"
                                        label={`${workspace.activeUsers} active`}
                                    />
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Workspace actions menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
            >
                <MenuItem onClick={() => {
                    if (selectedWorkspace) handleDeleteWorkspace(selectedWorkspace);
                    setAnchorEl(null);
                }}>
                    Delete
                </MenuItem>
            </Menu>

            {/* Create workspace dialog */}
            <Dialog
                open={isCreateDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>Create New Workspace</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Workspace Name"
                        fullWidth
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                    />
                    <TextField
                        margin="dense"
                        label="Description"
                        fullWidth
                        multiline
                        rows={3}
                        value={newWorkspaceDescription}
                        onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleCreateWorkspace}
                        disabled={!newWorkspaceName.trim()}
                        variant="contained"
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Empty state */}
            {filteredWorkspaces.length === 0 && !loading && (
                <Alert severity="info" sx={{ mt: 2 }}>
                    No workspaces found. Create a new workspace to get started.
                </Alert>
            )}
        </Box>
    );
};

export default WorkspaceList;