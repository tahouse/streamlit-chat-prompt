// ClipboardInspector.tsx
import CloseIcon from '@mui/icons-material/Close'; // Fix CloseIcon import
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    Paper,
    Stack,
    Typography
} from '@mui/material';
import React, { useState } from 'react';
import { Theme } from 'streamlit-component-lib';
import { Logger } from '../utils/logger';

// Use the content types in type checking
export const CONTENT_TYPE_GROUPS = {
    IMAGE: 'image/',
    TEXT: 'text/plain',
    HTML: 'text/html'
} as const;

export interface ClipboardItem {
    id: string;
    kind: string;
    type: string;
    as_file: File | null;
    content?: string | ArrayBuffer | null;
}

export interface ClipboardInspectorData {
    type: string;
    items?: ClipboardItem[];
}

export function inspectClipboard(e: ClipboardEvent): ClipboardInspectorData[] {
    Logger.debug("events", "Inspecting clipboard event", e);
    const data: ClipboardInspectorData[] = [];
    const clipboardData = e.clipboardData;

    if (clipboardData) {
        const items = Array.from(clipboardData.items || []).map((item, index) => {
            const itemData: ClipboardItem = {
                id: `clip-${index}`,
                kind: item.kind,
                type: item.type,
                as_file: item.kind === 'file' ? item.getAsFile() : null,
                content: null
            };

            // Get content based on type
            if (item.type === CONTENT_TYPE_GROUPS.TEXT || item.type === CONTENT_TYPE_GROUPS.HTML) {
                itemData.content = clipboardData.getData(item.type);
            }

            return itemData;
        });

        const uniqueItems = items.filter(item =>
            item.content !== null || item.as_file !== null
        );

        if (uniqueItems.length > 0) {
            data.push({
                type: 'clipboard',
                items: uniqueItems
            });
        }
    }

    return data;
}

interface ClipboardInspectorProps {
    open: boolean;
    data: ClipboardInspectorData[];
    theme?: Theme;
    onClose: () => void;
    onSelect: (selectedItems: ClipboardItem[]) => void;
}

export const ClipboardInspector: React.FC<ClipboardInspectorProps> = ({
    open,
    data,
    onClose,
    onSelect
}) => {
    const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
    const [selectAll, setSelectAll] = useState(false);

    const handleSelectAll = (checked: boolean) => {
        setSelectAll(checked);
        const newSelected: Record<string, boolean> = {};
        data.forEach(group => {
            group.items?.forEach(item => {
                newSelected[item.id] = checked;
            });
        });
        setSelectedItems(newSelected);
    };

    const handleSelectItem = (itemId: string, checked: boolean) => {
        setSelectedItems(prev => ({
            ...prev,
            [itemId]: checked
        }));
    };

    const handleConfirm = () => {
        const selected = data.flatMap(group =>
            group.items?.filter(item => selectedItems[item.id]) || []
        );
        onSelect(selected);
        onClose();
    };

    const renderContentPreview = (item: ClipboardItem) => {
        if (item.type.startsWith(CONTENT_TYPE_GROUPS.IMAGE) && item.as_file) {
            return (
                <Box sx={{ maxHeight: 200, overflow: 'hidden' }}>
                    <img
                        src={URL.createObjectURL(item.as_file)}
                        alt={item.as_file.name}
                        style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
                        onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                    />
                </Box>
            );
        }

        if (item.content) {
            return (
                <Box
                    sx={{
                        maxHeight: 200,
                        overflow: 'auto',
                        p: 1,
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace'
                    }}
                >
                    {item.content.toString()}
                </Box>
            );
        }

        return null;
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle sx={{ pb: 1 }}>
                Select Content to Include
                <IconButton
                    onClick={onClose}
                    sx={{ position: 'absolute', right: 8, top: 8 }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent>
                <Box sx={{ mb: 2 }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={selectAll}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                            />
                        }
                        label="Select All"
                    />
                </Box>

                <Stack spacing={2}>
                    {data.map((group, groupIdx) => (
                        <Paper key={groupIdx} variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>
                                {group.type}
                            </Typography>

                            {group.items?.map((item) => (
                                <Box key={item.id} sx={{ mb: 2 }}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={selectedItems[item.id] || false}
                                                onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                                            />
                                        }
                                        label={item.type}
                                    />
                                    {renderContentPreview(item)}
                                </Box>
                            ))}
                        </Paper>
                    ))}
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleConfirm}
                    disabled={Object.values(selectedItems).every(v => !v)}
                >
                    Add Selected
                </Button>
            </DialogActions>
        </Dialog>
    );
};