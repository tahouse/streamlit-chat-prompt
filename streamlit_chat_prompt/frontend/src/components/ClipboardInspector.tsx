// ClipboardInspector.tsx
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';

import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogTitle,
    IconButton,
    InputAdornment,
    ListItem,
    ListItemText,
    DialogContent as MuiDialogContent,
    Paper,
    Snackbar,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { Theme } from 'streamlit-component-lib';
import { Logger } from '../utils/logger';

export interface ClipboardInspectorData {
    type: string;
    types?: string[];
    items?: {
        kind: string;
        type: string;
        as_file: File | null;
    }[];
    files?: {
        name: string;
        type: string;
        size: number;
    }[];
}

interface ClipboardInspectorProps {
    open: boolean;
    data: ClipboardInspectorData[];
    theme?: Theme;
    onClose: () => void;
}

export function inspectClipboard(e: ClipboardEvent): ClipboardInspectorData[] {
    Logger.debug("events", "Inspecting clipboard event", e);

    const data: ClipboardInspectorData[] = [];
    const clipboardData = e.clipboardData;

    if (clipboardData) {
        const entry = {
            type: 'clipboard',
            types: Array.from(clipboardData.types || []),
            items: Array.from(clipboardData.items || []).map(item => ({
                kind: item.kind,
                type: item.type,
                as_file: item.kind === 'file' ? item.getAsFile() : null
            })),
            files: Array.from(clipboardData.files || []).map(file => ({
                name: file.name,
                type: file.type,
                size: file.size
            }))
        };

        data.push(entry);
        Logger.debug("events", "Clipboard data collected:", entry);
    }

    return data;
};

export const ClipboardInspector: React.FC<ClipboardInspectorProps> = ({
    open,
    data,
    theme,
    onClose
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '' });

    useEffect(() => {
        if (!open) {
            setSearchTerm('');
        }
    }, [open]);
    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    // Copy content to clipboard
    const handleCopy = useCallback(async (content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setSnackbar({ open: true, message: 'Copied to clipboard!' });
        } catch (err) {
            setSnackbar({ open: true, message: 'Failed to copy to clipboard' });
        }
    }, []);

    // Filter data based on search term
    const filterData = useCallback((content: string) => {
        return searchTerm ?
            content.toLowerCase().includes(searchTerm.toLowerCase()) :
            true;
    }, [searchTerm]);

    return (
        <>
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="lg"
                fullWidth
                sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 9999,
                    '& .MuiDialog-paper': {
                        width: '90vw',
                        maxWidth: '1200px',
                        height: '90vh',
                        maxHeight: '900px',
                        m: 2,
                        display: 'flex',
                        flexDirection: 'column'
                    }
                }}
            >
                <DialogTitle>
                    Clipboard Inspector
                    <IconButton
                        aria-label="close"
                        onClick={onClose}
                        sx={{
                            position: 'absolute',
                            right: 8,
                            top: 8,
                            color: theme?.textColor
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <Box sx={{ px: 3, pb: 2 }}>
                    <TextField
                        fullWidth
                        placeholder="Search clipboard contents..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{
                            '& .MuiInputBase-root': {
                                paddingLeft: 1
                            }
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            )
                        } as any}
                    />
                </Box>

                <MuiDialogContent sx={{ flex: 1, overflow: 'auto' }}>
                    {data.map((clipData, index) => (
                        <Box key={index} sx={{ mb: 2 }}>
                            <Typography variant="h6" gutterBottom>
                                Data Transfer: {clipData.type}
                            </Typography>

                            {clipData.types?.filter(filterData).map((type, idx) => (
                                <ListItem key={idx}>
                                    <ListItemText
                                        primary={type}
                                        sx={{
                                            '& .MuiListItemText-primary': {
                                                fontFamily: 'monospace'
                                            }
                                        }}
                                    />
                                    <IconButton
                                        size="small"
                                        onClick={() => handleCopy(type)}
                                    >
                                        <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                </ListItem>
                            ))}

                            {/* Render items */}
                            {clipData.items && clipData.items.length > 0 && (
                                <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Kind</TableCell>
                                                <TableCell>Type</TableCell>
                                                <TableCell>File</TableCell>
                                                <TableCell>Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {clipData.items.filter(item =>
                                                filterData(item.kind) ||
                                                filterData(item.type) ||
                                                (item.as_file && filterData(item.as_file.name))
                                            ).map((item, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell>{item.kind}</TableCell>
                                                    <TableCell>{item.type}</TableCell>
                                                    <TableCell>
                                                        {item.as_file ? item.as_file.name : 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleCopy(
                                                                item.as_file ?
                                                                    item.as_file.name :
                                                                    `${item.kind}:${item.type}`
                                                            )}
                                                        >
                                                            <ContentCopyIcon fontSize="small" />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Box>
                    ))}
                </MuiDialogContent>

                <DialogActions sx={{ p: 2, gap: 1 }}>
                    <Button
                        variant="outlined"
                        onClick={onClose}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                message={snackbar.message}
            />
        </>
    );
};