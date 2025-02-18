// ClipboardInspector.tsx
import * as turndownPluginGfm from '@joplin/turndown-plugin-gfm';
import CloseIcon from '@mui/icons-material/Close';

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
import TurndownService from 'turndown';
import { cleanBase64ImagesFromContent, extractCodeBlocks, ExtractedImage, extractImagesFromHtml } from '../utils/htmlProcessing';
import { Logger } from '../utils/logger';

const createTurndownService = () => {
    const service = new TurndownService({
        // headingStyle: 'atx',
        // bulletListMarker: '-',
        // codeBlockStyle: 'fenced',
        // fence: '```',
        // emDelimiter: '_',
        // strongDelimiter: '**'
    });
    // Add GFM plugin
    service.use(turndownPluginGfm.tables);
    // service.use(turndownPluginGfm.strikethrough);
    // service.use(turndownPluginGfm.taskListItems);

    // // Add custom rules with proper typing
    // service.addRule('codeBlocks', {
    //     filter: (node): boolean => {
    //         return (
    //             node.nodeName === 'PRE' ||
    //             (node.nodeName === 'CODE' && node.parentNode?.nodeName !== 'PRE')
    //         );
    //     },
    //     replacement: (content, node): string => {
    //         // Check if it's an inline code block
    //         if (node.nodeName === 'CODE' && node.parentNode?.nodeName !== 'PRE') {
    //             return `\`${content}\``;
    //         }

    //         // Handle block-level code
    //         const language = (node as HTMLElement).getAttribute?.('class')?.replace('language-', '') || '';
    //         return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
    //     }
    // });

    // service.addRule('strikethrough', {
    //     filter: ['del', 's', 'strike'] as (keyof HTMLElementTagNameMap)[],
    //     replacement: (content: string): string => `~~${content}~~`
    // });

    // Keep certain HTML elements
    // service.keep(['div', 'span']);

    return service;
};
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
    const turndownService = React.useMemo(() => createTurndownService(), []);
    const [showSvgs, setShowSvgs] = useState<Record<string, boolean>>({});
    useEffect(() => {
        if (open) {
            // Automatically process HTML content and convert to markdown
            data.forEach(group => {
                group.items?.forEach(item => {
                    // Pre-select HTML items and images, but not plain text
                    if (item.type === CONTENT_TYPE_GROUPS.HTML ||
                        item.type.startsWith(CONTENT_TYPE_GROUPS.IMAGE)) {
                        setSelectedItems(prev => ({
                            ...prev,
                            [item.id]: true
                        }));
                    }

                    // Auto-convert HTML to markdown
                    if (item.type === CONTENT_TYPE_GROUPS.HTML) {
                        setMarkdownConversion(prev => ({
                            ...prev,
                            [item.id]: true
                        }));
                    }

                    // Process HTML content for images
                    if (item.type === CONTENT_TYPE_GROUPS.HTML && item.content) {
                        processHtmlContent(item.id, item.content.toString());
                    }
                });
            });

            // Update select all state based on whether all non-text items are selected
            const nonTextItems = data.flatMap(group =>
                group.items?.filter(item =>
                    item.type !== CONTENT_TYPE_GROUPS.TEXT
                ) || []
            );
            setSelectAll(nonTextItems.length > 0);
        } else {
            // Reset state when closing
            setSelectedImages({});
            setExtractedImages({});
            setSelectedItems({});
            setSelectAll(false);
            setMarkdownConversion({});
            setShowSvgs({});
        }
    }, [open, data]);

    const processHtmlContent = async (itemId: string, html: string) => {
        const images = await extractImagesFromHtml(html);

        // Filter out SVGs for initial display
        const nonSvgImages = images.filter(img => !img.originalUrl.startsWith('inline-svg'));

        // Pre-select all non-SVG images
        const newSelectedImages: Record<string, boolean> = {};
        nonSvgImages.forEach((_, idx) => {
            const imageId = `${itemId}-${idx}`;
            newSelectedImages[imageId] = true;
        });

        setExtractedImages(prev => ({
            ...prev,
            [itemId]: images // Store all images but only show non-SVGs initially
        }));

        setSelectedImages(prev => ({
            ...prev,
            ...newSelectedImages
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
    const handleExtractSvgs = (itemId: string) => {
        setShowSvgs(prev => ({
            ...prev,
            [itemId]: true
        }));
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
        Logger.info('component', 'Starting markdown preview generation for HTML:', {
            itemId,
            htmlLength: html.length
        });

        // Step 1: Extract code blocks and replace with placeholders
        const codeBlocks = extractCodeBlocks(html);

        Logger.info('component', 'Extracted code blocks:', codeBlocks.map((block, index) => ({
            index,
            placeholder: `CODEBLOCK_PLACEHOLDER_${index}_ENDPLACEHOLDER`,
            language: block.language,
            htmlPreview: block.html.substring(0, 100) + '...',
            htmlLength: block.html.length,
            plainPreview: block.plainText.substring(0, 100) + '...',
            isInline: block.isInline,
        })));

        let workingHtml = html;

        // Create temporary placeholders for code blocks
        codeBlocks.forEach((block, index) => {
            // Only replace full code blocks with placeholders
            if (block.isStandalone) {
                const placeholder = `[CODEBLOCK${index}]`;
                workingHtml = workingHtml.replace(block.html, placeholder);
            }
            // Leave inline code in place to be handled by turndown service
        });

        // Step 2: Convert remaining HTML to markdown
        let markdown = turndownService.turndown(workingHtml);

        Logger.debug('component', 'After markdown conversion:', {
            markdown: markdown.substring(0, 200) + '...',
            containsPlaceholders: codeBlocks.map((_, index) => ({
                placeholder: `CODEBLOCK_PLACEHOLDER_${index}_ENDPLACEHOLDER`,
                found: markdown.includes(`CODEBLOCK_PLACEHOLDER_${index}_ENDPLACEHOLDER`)
            }))
        });

        markdown = cleanBase64ImagesFromContent(
            markdown,
            (extractedImages[itemId] || []).length
        );
        Logger.debug('component', 'Intermediate minus base64 images:', {
            markdown,
        });

        // Step 3: Replace placeholders with properly formatted code blocks
        let finalMarkdown = markdown;
        codeBlocks.forEach((block, index) => {
            const placeholder = `[CODEBLOCK${index}]`;

            // Clean up the code content while preserving line breaks
            let codeContent = block.plainText;

            // Format as markdown code block, ensuring proper line breaks
            const formattedCode = block.isInline
                ? `\`${block.plainText}\``  // Inline code with single backticks
                : [                         // Block code with triple backticks
                    '',
                    '```' + (block.language || ''),
                    block.plainText,
                    '```',
                    ''
                ].join('\n');


            Logger.debug('component', `Processed code block ${index}:`, {
                placeholder,
                originalContent: codeContent.substring(0, 100) + '...',
                formattedBlock: formattedCode.substring(0, 100) + '...',
                markdownBefore: finalMarkdown.substring(0, 100) + '...',
                placeholderInMarkdown: finalMarkdown.includes(placeholder),
                containsSpecialChars: {
                    gt: codeContent.includes('>'),
                    lt: codeContent.includes('<'),
                    amp: codeContent.includes('&'),
                    encoded: {
                        gt: codeContent.includes('&gt;'),
                        lt: codeContent.includes('&lt;'),
                        amp: codeContent.includes('&amp;')
                    }
                }
            });

            // Simple string replacement should work now
            finalMarkdown = finalMarkdown.replace(placeholder, formattedCode);

            // Also try with escaped placeholder just in case
            // eslint-disable-next-line no-useless-escape
            const escapedPlaceholder = placeholder.replace(/[\[\]]/g, '\\$&');
            finalMarkdown = finalMarkdown.replace(escapedPlaceholder, formattedCode);

            Logger.debug('component', `After replacement for block ${index}:`, {
                success: !finalMarkdown.includes(placeholder),
                markdownPreview: finalMarkdown.substring(0, 100) + '...'
            });
        });

        // After all replacements
        const remainingPlaceholders = finalMarkdown.match(/\[CODEBLOCK\d+\]/g);
        Logger.debug('component', 'Final check:', {
            remainingPlaceholders,
            finalMarkdownPreview: finalMarkdown.substring(0, 200) + '...',
            totalLength: finalMarkdown.length
        });
        if (remainingPlaceholders) {
            Logger.warn('component', 'Remaining placeholders:', remainingPlaceholders);
        }

        // Step 5: Handle already extracted images
        const itemImages = extractedImages[itemId] || [];
        const selectedItemImages = itemImages.filter((_, idx) =>
            selectedImages[`${itemId}-${idx}`]
        );

        selectedItemImages.forEach((image, idx) => {
            if (!image.originalUrl.startsWith('inline-svg')) {
                const imgRegex = new RegExp(
                    `!\\[.*?\\]\\(${image.originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`,
                    'g'
                );
                finalMarkdown = finalMarkdown.replace(
                    imgRegex,
                    `![Original: ${image.originalUrl}][${idx}]`
                );
            }
        });

        // Add image references if needed
        if (selectedItemImages.length > 0) {
            finalMarkdown += '\n\n';
            selectedItemImages.forEach((_, idx) => {
                finalMarkdown += `[${idx}]: attachment:${idx}\n`;
            });
        }

        return finalMarkdown;
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

        if (item.type.startsWith(CONTENT_TYPE_GROUPS.IMAGE) && item.as_file) {
            allImages.push({ file: item.as_file, id: `${item.id}-direct` });
        }

        const itemImages = extractedImages[item.id] || [];
        const filteredImages = showSvgs[item.id] ? itemImages : itemImages.filter(img => !img.originalUrl.startsWith('inline-svg'));
        allImages.push(...filteredImages.map((img, idx) => ({ file: img.file, id: `${item.id}-${idx}` })));

        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}> {/* Reduced gap from 1 to 0.5 */}
                {allImages.length > 0 && (
                    <Box sx={{ mt: .5 }}>
                        <Typography variant="subtitle2">{item.type.startsWith(CONTENT_TYPE_GROUPS.IMAGE) ? 'Image:' : 'Images'}</Typography>
                        <ImageList sx={{ maxHeight: 120 }} cols={4} rowHeight={80}>
                            {allImages.map(({ file, id }) => (
                                <ImageListItem key={id} sx={{ position: 'relative' }}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox size="small" checked={selectedImages[id] || false}
                                                onChange={(e) => setSelectedImages(prev => ({ ...prev, [id]: e.target.checked }))} />
                                        }
                                        label=""
                                        sx={{ position: 'absolute', top: 0, right: 0, zIndex: 1, m: 0 }}
                                    />
                                    <img src={URL.createObjectURL(file)} alt={id} style={{ objectFit: 'cover', height: '80px', width: '100%' }}
                                        onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)} />
                                </ImageListItem>
                            ))}
                        </ImageList>
                    </Box>
                )}

                {selectedItems[item.id] && item.content && (
                    <Box sx={{ maxHeight: 200, overflow: 'auto', p: 1, bgcolor: 'background.paper', borderRadius: 1, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                        {item.type === CONTENT_TYPE_GROUPS.HTML ?
                            (markdownConversion[item.id] ? generateMarkdownPreview(item.content.toString(), item.id) : item.content.toString()) :
                            item.content.toString()}
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
                        <Paper key={groupIdx} variant="outlined" sx={{ p: 1.5 }}>
                            <Typography variant="h6" sx={{ mb: 1 }}>
                                {group.type}
                            </Typography>

                            {group.items?.map((item) => (
                                <Box key={item.id} sx={{ mb: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                                        {item.type === CONTENT_TYPE_GROUPS.HTML && (
                                            <>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={markdownConversion[item.id] ?? true}
                                                            onChange={(e) => handleMarkdownConversion(item.id, e.target.checked)}
                                                        />
                                                    }
                                                    label="Convert to Markdown"
                                                />
                                                {!showSvgs[item.id] && (
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        onClick={() => handleExtractSvgs(item.id)}
                                                    >
                                                        Extract SVGs
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </Box>
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