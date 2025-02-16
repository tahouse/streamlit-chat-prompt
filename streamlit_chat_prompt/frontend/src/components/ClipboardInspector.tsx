// ClipboardInspector.tsx
import CloseIcon from '@mui/icons-material/Close';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography
} from '@mui/material';
import React from 'react';
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
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth={true}
            PaperProps={{
                sx: {
                    width: '90vw',
                    maxWidth: '1200px',
                    height: '200vh',
                    maxHeight: '900px',
                    minHeight: '600px',
                    m: 2,
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
        >
            <DialogTitle>
                Clipboard Contents
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
            <DialogContent sx={{ flex: 1, overflow: 'auto' }}>
                {data.map((data, index) => (
                    <Box key={index} sx={{ mb: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            Data Transfer: {data.type}
                        </Typography>

                        {data.types && (
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle1" gutterBottom>
                                    Types ({data.types.length}):
                                </Typography>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <List dense>
                                        {data.types.map((type, idx) => (
                                            <ListItem key={idx}>
                                                <ListItemText
                                                    primary={type}
                                                    sx={{
                                                        '& .MuiListItemText-primary': {
                                                            fontFamily: 'monospace'
                                                        }
                                                    }}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Paper>
                            </Box>
                        )}

                        {data.items && data.items.length > 0 && (
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle1" gutterBottom>
                                    Items ({data.items.length}):
                                </Typography>
                                <TableContainer component={Paper} variant="outlined">
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Kind</TableCell>
                                                <TableCell>Type</TableCell>
                                                <TableCell>File</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.items.map((item, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell sx={{ fontFamily: 'monospace' }}>
                                                        {item.kind}
                                                    </TableCell>
                                                    <TableCell sx={{ fontFamily: 'monospace' }}>
                                                        {item.type}
                                                    </TableCell>
                                                    <TableCell sx={{ fontFamily: 'monospace' }}>
                                                        {item.as_file ? item.as_file.name : 'N/A'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        )}

                        {data.files && data.files.length > 0 &&
                            (!data.items || data.files.some(file =>
                                !(data.items?.find(item =>
                                    item.as_file && item.as_file.name === file.name
                                ))
                            )) && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="subtitle1" gutterBottom>
                                        Additional Files ({data.files.length}):
                                    </Typography>
                                    <Paper variant="outlined" sx={{ p: 2 }}>
                                        <List dense>
                                            {data.files.map((file, idx) => (
                                                <ListItem key={idx}>
                                                    <ListItemText
                                                        primary={file.name}
                                                        secondary={`${file.type}, ${file.size} bytes`}
                                                        sx={{
                                                            '& .MuiListItemText-primary': {
                                                                fontFamily: 'monospace'
                                                            },
                                                            '& .MuiListItemText-secondary': {
                                                                fontFamily: 'monospace'
                                                            }
                                                        }}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Paper>
                                </Box>
                            )}
                    </Box>
                ))}
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button
                    variant="outlined"
                    onClick={onClose}
                    sx={{ minWidth: '100px' }}
                >
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={onClose}
                    sx={{ minWidth: '100px' }}
                >
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};