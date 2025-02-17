// ClipboardInspector.tsx
import CloseIcon from '@mui/icons-material/Close'; // Fix CloseIcon import
import TurndownService from 'turndown';
import { ExtractedImage, extractImagesFromHtml } from '../utils/htmlProcessing';

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
    ImageList,
    ImageListItem,
    Paper,
    Stack,
    Typography
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { Theme } from 'streamlit-component-lib';
import { Logger } from '../utils/logger';

export const DIALOG_HEIGHTS = {
    CLIPBOARD_INSPECTOR: 600,
    CLIPBOARD_INSPECTOR_MAX: 900,
    DIALOG_CONTENT: 500,
    BASE_PADDING: 50
} as const;
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
    convertToMarkdown?: boolean;
    extractedImages?: ExtractedImage[];

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
    const [selectedImages, setSelectedImages] = useState<Record<string, boolean>>({});
    const [extractedImages, setExtractedImages] = useState<Record<string, ExtractedImage[]>>({});
    const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
    const [selectAll, setSelectAll] = useState(false);
    const [markdownConversion, setMarkdownConversion] = useState<Record<string, boolean>>({});
    const turndownService = React.useMemo(() => new TurndownService(), []);

    // Reset all state when dialog closes
    useEffect(() => {
        if (!open) {
            // Reset all state
            setSelectedImages({});
            setExtractedImages({});
            setSelectedItems({});
            setSelectAll(false);
            setMarkdownConversion({});
        }
    }, [open]);


    // Add this function to process HTML content
    const processHtmlContent = async (itemId: string, html: string) => {
        const images = await extractImagesFromHtml(html);
        setExtractedImages(prev => ({
            ...prev,
            [itemId]: images
        }));
    };

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


    const handleMarkdownConversion = (itemId: string, checked: boolean) => {
        setMarkdownConversion(prev => ({
            ...prev,
            [itemId]: checked
        }));

        // Only auto-select if enabling markdown
        if (checked && !selectedItems[itemId]) {
            setSelectedItems(prev => ({
                ...prev,
                [itemId]: true
            }));
        }
    };


    const generateMarkdownPreview = React.useMemo(() => (html: string, itemId: string) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const itemImages = extractedImages[itemId] || [];
        const selectedItemImages = itemImages.filter((_, idx) =>
            selectedImages[`${itemId}-${idx}`]
        );

        // Track which SVGs are selected
        const selectedSvgIndices = new Set(
            selectedItemImages
                .map((img, idx) => img.originalUrl === 'inline-svg' ? idx : -1)
                .filter(idx => idx !== -1)
        );

        // Create placeholders only for selected SVGs
        const svgPlaceholders = new Map<string, string>();
        const svgs = doc.getElementsByTagName('svg');
        Array.from(svgs).forEach((svg, idx) => {
            // Only create placeholder if this SVG was selected
            if (selectedSvgIndices.has(idx)) {
                // Use unescaped markdown image syntax as placeholder
                const placeholder = `![Original: Inline SVG][${idx}]`; // Removed escaping
                svgPlaceholders.set(placeholder, svg.outerHTML);
                svg.outerHTML = placeholder;
            }
        });

        // Convert to markdown
        let markdown = turndownService.turndown(doc.body.innerHTML);
        markdown = markdown.replace(
            /!\\\[Original: (?:Inline SVG|.*?)\\\]\\\[(\d+)\\\]/g,
            (_, idx) => `![Original: Inline SVG][${idx}]`
        );

        // Replace image references (SVG placeholders already in correct format)
        selectedItemImages.forEach((image, idx) => {
            if (!image.originalUrl.startsWith('inline-svg')) {
                // Handle regular images - use simpler regex without escaping
                const imgRegex = new RegExp(
                    `!\\[.*?\\]\\(${image.originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`,
                    'g'
                );
                // Use unescaped markdown syntax
                markdown = markdown.replace(
                    imgRegex,
                    `![Original: ${image.originalUrl}][${idx}]`
                );
            }
        });

        // Add attachment references at the end
        if (selectedItemImages.length > 0) {
            markdown += '\n\n';
            selectedItemImages.forEach((_, idx) => {
                markdown += `[${idx}]: attachment:${idx}\n`;
            });
        }

        return markdown;
    }, [extractedImages, selectedImages, turndownService]);


    const handleConfirm = () => {
        const selected = data.flatMap(group =>
            group.items?.filter(item => selectedItems[item.id]).map(item => {
                // Get all selected images for this item
                let selectedItemImages: ExtractedImage[] = [];

                // Handle direct image files
                if (item.type.startsWith(CONTENT_TYPE_GROUPS.IMAGE) && item.as_file && selectedImages[`${item.id}-direct`]) {
                    selectedItemImages.push({ file: item.as_file, originalUrl: '' });
                }

                // Handle extracted images from HTML
                const extractedItemImages = extractedImages[item.id] || [];
                const selectedExtractedImages = extractedItemImages.filter((_, idx) =>
                    selectedImages[`${item.id}-${idx}`]
                );
                selectedItemImages = [...selectedItemImages, ...selectedExtractedImages];

                if (item.type === CONTENT_TYPE_GROUPS.HTML && markdownConversion[item.id]) {
                    // Generate markdown content ONCE and store it
                    const markdownContent = generateMarkdownPreview(item.content?.toString() || '', item.id);
                    Logger.debug('component', 'Generated markdown content:', markdownContent);  // Debug log

                    return {
                        ...item,
                        content: markdownContent,  // Use the stored content
                        convertToMarkdown: false,  // Set to false since we've already converted
                        extractedImages: selectedItemImages
                    };
                }

                return {
                    ...item,
                    extractedImages: selectedItemImages
                };
            }) || []
        );

        Logger.debug('component', 'Selected items with images:', selected);
        onSelect(selected);
        onClose();

        setTimeout(() => {
            setSelectedImages({});
            setExtractedImages({});
            setSelectedItems({});
            setSelectAll(false);
            setMarkdownConversion({});
        }, 100);
    };

    const renderContentPreview = (item: ClipboardItem) => {
        const allImages: { file: File, id: string }[] = [];

        // Add direct image if present
        if (item.type.startsWith(CONTENT_TYPE_GROUPS.IMAGE) && item.as_file) {
            allImages.push({
                file: item.as_file,
                id: `${item.id}-direct`
            });
        }

        // Add extracted images if present
        const itemImages = extractedImages[item.id] || [];
        allImages.push(...itemImages.map((img, idx) => ({
            file: img.file,
            id: `${item.id}-${idx}`
        })));

        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {/* HTML Controls */}
                {item.type === CONTENT_TYPE_GROUPS.HTML && (
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={markdownConversion[item.id] || false}
                                    onChange={(e) => handleMarkdownConversion(item.id, e.target.checked)}
                                />
                            }
                            label="Convert to Markdown"  // Changed this label to be consistent
                        />
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => processHtmlContent(item.id, item.content?.toString() || '')}
                        >
                            Extract Images
                        </Button>
                    </Box>
                )}

                {/* Images Section */}
                {allImages.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                        <Typography variant="subtitle2">
                            {item.type.startsWith(CONTENT_TYPE_GROUPS.IMAGE) ? 'Image:' : 'Extracted Images:'}
                        </Typography>
                        <ImageList sx={{ maxHeight: 120 }} cols={4} rowHeight={80}>
                            {allImages.map(({ file, id }) => (
                                <ImageListItem key={id} sx={{ position: 'relative' }}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                size="small"
                                                checked={selectedImages[id] || false}
                                                onChange={(e) => setSelectedImages(prev => ({
                                                    ...prev,
                                                    [id]: e.target.checked
                                                }))}
                                            />
                                        }
                                        label=""
                                        sx={{
                                            position: 'absolute',
                                            top: 0,
                                            right: 0,
                                            zIndex: 1,
                                            m: 0 // Remove margin
                                        }}
                                    />
                                    <img
                                        src={URL.createObjectURL(file)}
                                        alt={`${id}`}
                                        style={{
                                            objectFit: 'cover',
                                            height: '80px',
                                            width: '100%'
                                        }}
                                        onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                                    />
                                </ImageListItem>
                            ))}
                        </ImageList>
                    </Box>
                )}

                {/* Text Content */}
                {item.content && (
                    <Box sx={{
                        maxHeight: 200,
                        overflow: 'auto',
                        p: 1,
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace'
                    }}>
                        {markdownConversion[item.id]
                            ? generateMarkdownPreview(item.content.toString(), item.id)
                            : item.content.toString()}
                    </Box>
                )}
            </Box>
        );
    };
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    maxHeight: DIALOG_HEIGHTS.CLIPBOARD_INSPECTOR_MAX,
                    height: DIALOG_HEIGHTS.CLIPBOARD_INSPECTOR,
                    margin: '16px', // Add margin around the dialog
                    width: 'calc(100% - 32px)', // Adjust width to account for margins
                    position: 'relative', // Ensure proper positioning
                    overflow: 'hidden' // Prevent content overflow
                }
            }}
        >
            <DialogTitle sx={{
                pb: 1, px: 3, // Increase horizontal padding
                pt: 2 // Increase top padding
            }}>
                Select Content to Include
                <IconButton
                    onClick={onClose}
                    sx={{ position: 'absolute', right: 8, top: 8 }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{
                height: DIALOG_HEIGHTS.DIALOG_CONTENT, overflowY: 'auto',
                px: 3, // Increase horizontal padding
                pb: 3  // Increase bottom padding
            }}>
                <Box sx={{ mb: 2 }}> {/* Remove height, just add margin bottom */}
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
                                        label={
                                            item.type === CONTENT_TYPE_GROUPS.HTML
                                                ? (markdownConversion[item.id] ? 'text/markdown' : 'text/html')
                                                : item.type
                                        }
                                    />
                                    {renderContentPreview(item)}
                                </Box>
                            ))}
                        </Paper>
                    ))}
                </Stack>
            </DialogContent>

            <DialogActions sx={{
                px: 3, // Increase horizontal padding
                pb: 2  // Increase bottom padding
            }}>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleConfirm}
                    disabled={Object.values(selectedItems).every(v => !v)}
                >
                    Add Selected
                </Button>
            </DialogActions>
        </Dialog >
    );
};