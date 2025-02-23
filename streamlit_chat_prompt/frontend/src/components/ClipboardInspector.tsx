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
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    ImageList,
    ImageListItem,
    MenuItem,
    Select,
    Stack
} from '@mui/material';

import React, { useEffect, useState } from 'react';
import { Theme } from 'streamlit-component-lib';
import TurndownService from 'turndown';
import { cleanBase64ImagesFromContent, extractCodeBlocks, ExtractedImage, extractImagesFromHtml, getSortedLanguageOptions, guessCodeLanguage } from '../utils/htmlProcessing';
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
    defaultLanguage?: string;
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, setSelectAll] = useState(false);
    const [markdownConversion, setMarkdownConversion] = useState<Record<string, boolean>>({});
    const turndownService = React.useMemo(() => createTurndownService(), []);
    const [showSvgs, setShowSvgs] = useState<Record<string, boolean>>({});
    const [previewContent, setPreviewContent] = useState<Record<string, string>>({});
    const allItems = data.flatMap(group => group.items || []);
    const [selectedLanguages, setSelectedLanguages] = useState<Record<string, string>>({});

    const languageOptions = React.useMemo(() => {
        // Create a Set of detected languages, filtering out undefined values
        const detected = new Set<string>(
            data.flatMap(group =>
                (group.items || [])
                    .filter((item): item is ClipboardItem & { content: string } =>
                        item.type === CONTENT_TYPE_GROUPS.HTML &&
                        item.content !== null &&
                        item.content !== undefined
                    )
                    .map(item => guessCodeLanguage(item.content).name)
                    .filter((name): name is string => name !== undefined)
            )
        );

        return getSortedLanguageOptions(detected);
    }, [data]);

    const getInitialLanguageSelection = (content: string): string => {
        const codeBlocks = extractCodeBlocks(content);
        const uniqueLanguages = new Set(
            codeBlocks
                .filter(block => block.language && !block.isInline)
                .map(block => block.language!)  // Add ! since we filtered for non-null
        );

        return uniqueLanguages.size > 1 ? 'multiple' :
            uniqueLanguages.size === 1 ? (Array.from(uniqueLanguages)[0] ?? 'none') :
                'none';
    };

    const collectItemImages = (item: ClipboardItem) => {
        const images: Array<{ file: File, id: string }> = [];

        // Add direct image files
        if (item.type.startsWith(CONTENT_TYPE_GROUPS.IMAGE) && item.as_file) {
            images.push({ file: item.as_file, id: `${item.id}-direct` });
        }

        // Add extracted images
        const itemImages = extractedImages[item.id] || [];
        const filteredImages = showSvgs[item.id]
            ? itemImages
            : itemImages.filter(img => !img.originalUrl.startsWith('inline-svg'));

        images.push(...filteredImages.map((img, idx) => ({
            file: img.file,
            id: `${item.id}-${idx}`
        })));

        return images;
    };

    const getSelectAllState = (items: ClipboardItem[], selectedItems: Record<string, boolean>, selectedImages: Record<string, boolean>) => {
        // Get all available images across all items
        const allImages = items.flatMap(item => collectItemImages(item));

        // Count total selectable items and selected items
        let totalItems = 0;
        let selectedCount = 0;

        items.forEach(item => {
            if (item.type === CONTENT_TYPE_GROUPS.HTML) {
                // HTML items have two possible selections (markdown and html)
                totalItems += 2; // Count both markdown and html options
                if (selectedItems[`${item.id}-markdown`]) selectedCount++;
                if (selectedItems[`${item.id}-html`]) selectedCount++;
            } else {
                // Non-HTML items have one selection
                totalItems += 1;
                if (selectedItems[item.id]) selectedCount++;
            }
        });

        // Add image counts
        totalItems += allImages.length;
        selectedCount += allImages.filter(({ id }) => selectedImages[id]).length;

        return {
            checked: selectedCount === totalItems && totalItems > 0,
            indeterminate: selectedCount > 0 && selectedCount < totalItems,
            selectedCount
        };
    };

    useEffect(() => {
        if (open) {
            // Automatically process HTML content and convert to markdown
            data.forEach(group => {
                group.items?.forEach(item => {
                    // Pre-select HTML items and images, but not plain text
                    if (item.type === CONTENT_TYPE_GROUPS.HTML) {
                        // Select markdown by default for HTML content
                        setSelectedItems(prev => ({
                            ...prev,
                            [`${item.id}-markdown`]: true,
                            [`${item.id}-html`]: false
                        }));

                        // Auto-convert HTML to markdown
                        setMarkdownConversion(prev => ({
                            ...prev,
                            [item.id]: true
                        }));

                        // Process HTML content for images
                        if (item.content) {
                            processHtmlContent(item.id, item.content.toString());
                            // Get initial language selection
                            const initialLanguage = getInitialLanguageSelection(
                                item.content.toString()
                            );
                            setSelectedLanguages(prev => ({
                                ...prev,
                                [item.id]: initialLanguage
                            }));
                        }
                    } else if (item.type.startsWith(CONTENT_TYPE_GROUPS.IMAGE)) {
                        setSelectedItems(prev => ({
                            ...prev,
                            [item.id]: true
                        }));
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
            setSelectedLanguages({});
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

        // Create new state objects
        const newSelected: Record<string, boolean> = {};
        const newImageSelections: Record<string, boolean> = {};

        // Process all items
        data.forEach(group => {
            group.items?.forEach(item => {
                if (item.type === CONTENT_TYPE_GROUPS.HTML) {
                    // For HTML items, select both markdown and html versions
                    newSelected[`${item.id}-markdown`] = checked;
                    newSelected[`${item.id}-html`] = checked;

                    // If selecting all, also enable markdown conversion
                    if (checked) {
                        setMarkdownConversion(prev => ({
                            ...prev,
                            [item.id]: true
                        }));
                    }
                } else {
                    // For non-HTML items, select normally
                    newSelected[item.id] = checked;
                }

                // Handle all associated images
                const images = collectItemImages(item);
                images.forEach(({ id }) => {
                    newImageSelections[id] = checked;
                });
            });
        });

        // Update both states at once
        setSelectedItems(newSelected);
        setSelectedImages(newImageSelections);
    };

    const handleSelectItem = (itemId: string, checked: boolean) => {
        setSelectedItems(prev => ({
            ...prev,
            [itemId]: checked
        }));
    };

    const generateMarkdownPreview = React.useMemo(() => (html: string, itemId: string, selectedLanguage: string
    ) => {
        Logger.info('component', 'Starting markdown preview generation for HTML:', {
            itemId,
            htmlLength: html.length,
            selectedLanguage: selectedLanguage,
            htmlPreview: html.substring(0, 100) + '...'
        });

        // Step 1: Clean the HTML content
        let workingHtml = html;

        // Step 1: Extract code blocks and replace with placeholders
        const codeBlocks = extractCodeBlocks(workingHtml);

        Logger.info('component', 'Extracted code blocks:', codeBlocks.map((block, index) => ({
            index,
            placeholder: `CODEBLOCK_PLACEHOLDER_${index}_ENDPLACEHOLDER`,
            language: block.language, // Use selected language if specified
            htmlPreview: block.html.substring(0, 100) + '...',
            htmlLength: block.html.length,
            plainPreview: block.plainText.substring(0, 100) + '...',
            isInline: block.isInline,
            isStandalone: block.isStandalone,
        })));

        // Step 2: Create temporary placeholders for code blocks
        codeBlocks.forEach((block, index) => {
            // Only replace full code blocks with placeholders
            if (!block.isInline) {
                const placeholder = `[CODEBLOCK${index}]`;
                workingHtml = workingHtml.replace(block.html, placeholder);
            }
            // Leave inline code in place to be handled by turndown service
        });
        Logger.debug('component', 'After code block replacement:', {
            workingHtmlPreview: workingHtml.substring(0, 200) + '...',
        });

        workingHtml = stripHtmlStyling(workingHtml);

        // Step 3: Convert remaining HTML to markdown
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

        // Step 4: Replace placeholders with properly formatted code blocks
        let finalMarkdown = markdown;
        codeBlocks.forEach((block, index) => {
            const placeholder = `[CODEBLOCK${index}]`;
            let language = '';
            if (selectedLanguage === 'multiple') {
                // Use detected language if available, otherwise empty
                language = block.language || '';
            } else {
                // Use selected language
                language = selectedLanguage === 'none' ? '' : selectedLanguage;
            }

            // Clean up the code content while preserving line breaks
            let codeContent = block.plainText;

            // Format as markdown code block, ensuring proper line breaks
            const formattedCode = block.isInline
                ? `\`${block.plainText}\``  // Inline code with single backticks
                : [                         // Block code with triple backticks
                    '',
                    '```' + language,
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
        const remainingPlaceholders = finalMarkdown.match(/\[CODEBLOCK\d+\]/g);
        Logger.debug('component', 'Final check:', {
            remainingPlaceholders,
            finalMarkdownPreview: finalMarkdown.substring(0, 200) + '...',
            totalLength: finalMarkdown.length
        });
        if (remainingPlaceholders) {
            Logger.warn('component', 'Remaining placeholders:', remainingPlaceholders);
        }

        // Step 5: Handle images
        const itemImages = extractedImages[itemId] || [];
        const selectedItemImages = itemImages.filter((_, idx) =>
            selectedImages[`${itemId}-${idx}`]
        );

        // First, remove all image references from the markdown
        finalMarkdown = finalMarkdown.replace(/!\[(?:.*?)\](?:\[.*?\]|\(.*?\))/g, '');

        // Then, only add back the selected images
        selectedItemImages.forEach((image, idx) => {
            if (!image.originalUrl.startsWith('inline-svg')) {
                // Find the original position of this image in the HTML
                const tempDoc = document.createElement('div');
                tempDoc.innerHTML = html;
                const allImages = Array.from(tempDoc.querySelectorAll('img'));
                const imageIndex = allImages.findIndex(img =>
                    img.src === image.originalUrl ||
                    img.getAttribute('data-original-url') === image.originalUrl
                );

                if (imageIndex !== -1) {
                    // Try to insert the image reference close to its original position
                    const beforeText = finalMarkdown.slice(0, Math.floor(finalMarkdown.length * (imageIndex / allImages.length)));
                    const afterText = finalMarkdown.slice(Math.floor(finalMarkdown.length * (imageIndex / allImages.length)));

                    finalMarkdown = `${beforeText}![image-${idx}][${idx}]${afterText}`;
                } else {
                    // If we can't determine position, append to the end of the nearest paragraph
                    finalMarkdown = finalMarkdown.replace(/(\n\n|\n$)/, `\n\n![image-${idx}][${idx}]$1`);
                }
            }
        });

        // Clean up multiple newlines
        finalMarkdown = finalMarkdown
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        // Add image references only for selected images
        if (selectedItemImages.length > 0) {
            finalMarkdown += '\n\n<image-attachments>\n';
            selectedItemImages.forEach((_, idx) => {
                finalMarkdown += `  <attachment id="${idx}" />\n`;
            });
            finalMarkdown += '</image-attachments>';
        }

        return finalMarkdown;
    }, [extractedImages, selectedImages, turndownService]);

    useEffect(() => {
        // Update markdown preview for each HTML item when selections change
        data.forEach(group => {
            group.items?.forEach(item => {
                if (item.type === CONTENT_TYPE_GROUPS.HTML &&
                    markdownConversion[item.id] &&
                    item.content) {

                    const updatedMarkdown = generateMarkdownPreview(
                        item.content.toString(),
                        item.id,
                        selectedLanguages[item.id] || 'none' // Pass selected language
                    );

                    setPreviewContent(prev => ({
                        ...prev,
                        [item.id]: updatedMarkdown
                    }));
                }
            });
        });
    }, [selectedImages, markdownConversion, generateMarkdownPreview, data, selectedLanguages]);

    const handleConfirm = React.useCallback(() => {
        const selected = data.flatMap(group =>
            group.items?.filter(item => {
                if (item.type === CONTENT_TYPE_GROUPS.HTML) {
                    // Include if either markdown or html is selected
                    return selectedItems[`${item.id}-markdown`] ||
                        selectedItems[`${item.id}-html`];
                }
                return selectedItems[item.id];
            }).map(item => {
                let selectedItemImages: ExtractedImage[] = [];

                // Handle direct image files
                if (item.type.startsWith(CONTENT_TYPE_GROUPS.IMAGE) &&
                    item.as_file &&
                    selectedImages[`${item.id}-direct`]) {
                    selectedItemImages.push({ file: item.as_file, originalUrl: '' });
                }

                // Handle extracted images from HTML
                const extractedItemImages = extractedImages[item.id] || [];
                const filteredImages = showSvgs[item.id]
                    ? extractedItemImages
                    : extractedItemImages.filter(img => !img.originalUrl.startsWith('inline-svg'));

                const selectedExtractedImages = filteredImages.filter((_, idx) =>
                    selectedImages[`${item.id}-${idx}`]
                );
                selectedItemImages = [...selectedItemImages, ...selectedExtractedImages];

                // For HTML content, create separate markdown/html versions based on selection
                if (item.type === CONTENT_TYPE_GROUPS.HTML) {
                    if (selectedItems[`${item.id}-markdown`]) {
                        return {
                            ...item,
                            content: previewContent[item.id],
                            convertToMarkdown: false,
                            extractedImages: selectedItemImages,
                            language: selectedLanguages[item.id] || 'none' // Add language
                        };
                    } else {
                        return {
                            ...item,
                            extractedImages: selectedItemImages
                        };
                    }
                }

                return {
                    ...item,
                    extractedImages: selectedItemImages
                };
            }) || []
        );

        onSelect(selected);
        onClose();

        setTimeout(() => {
            setSelectedLanguages({});
            setSelectedImages({});
            setExtractedImages({});
            setSelectedItems({});
            setSelectAll(false);
            setMarkdownConversion({});
            setShowSvgs({});
        }, 100);
    }, [data, selectedItems, selectedImages, showSvgs, previewContent, extractedImages, selectedLanguages, onSelect, onClose]);



    const renderImagePreview = (images: Array<{ file: File, id: string }>) => {
        if (!images.length) return null;

        const imageState = {
            totalImages: images.length,
            selectedCount: images.filter(({ id }) => selectedImages[id]).length,
            get checked() {
                return this.selectedCount === this.totalImages;
            },
            get indeterminate() {
                return this.selectedCount > 0 && this.selectedCount < this.totalImages;
            }
        };

        return (
            <Box sx={{ mt: .5 }}>
                <Box sx={{
                    mb: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Box sx={{ typography: 'body1' }}>
                        Images
                    </Box>
                    <FormControlLabel
                        control={
                            <Checkbox
                                size="small"
                                checked={imageState.checked}
                                indeterminate={imageState.indeterminate}
                                onChange={(e) => {
                                    const newSelections = { ...selectedImages };
                                    images.forEach(({ id }) => {
                                        newSelections[id] = e.target.checked;
                                    });
                                    setSelectedImages(newSelections);
                                }}
                            />
                        }
                        label={`Select All Images (${imageState.selectedCount}/${imageState.totalImages})`}
                    />
                </Box>
                <ImageList sx={{ maxHeight: 120 }} cols={4} rowHeight={80}>
                    {images.map(({ file, id }) => (
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
                                    m: 0,
                                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                    borderRadius: '4px',
                                    '& .MuiCheckbox-root': {
                                        padding: '4px',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                        },
                                    },
                                    boxShadow: '0 0 3px rgba(0, 0, 0, 0.2)',
                                }}
                            />
                            <img
                                src={URL.createObjectURL(file)}
                                alt={id}
                                style={{ objectFit: 'cover', height: '80px', width: '100%' }}
                                onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                            />
                        </ImageListItem>
                    ))}
                </ImageList>
            </Box>
        );
    };

    const handleExtractSvgs = (itemId: string) => {
        setShowSvgs(prev => ({
            ...prev,
            [itemId]: true
        }));
    };

    const renderItem = (item: ClipboardItem) => {
        if (item.type === CONTENT_TYPE_GROUPS.HTML) {
            return (
                <Stack spacing={1}>
                    {/* Markdown Option */}
                    <Box>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={selectedItems[`${item.id}-markdown`] || false}
                                    onChange={(e) => handleSelectItem(`${item.id}-markdown`, e.target.checked)}
                                />
                            }
                            label="text/markdown (converted from html)"
                        />
                        {!showSvgs[item.id] && (
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleExtractSvgs(item.id)}
                                sx={{ mr: 2 }}  // Add margin-right of 16px (mr: 2 = 16px in MUI)
                            >
                                Extract SVGs
                            </Button>
                        )}
                        {selectedItems[`${item.id}-markdown`] && (
                            <FormControl size="small" sx={{ mt: 1, minWidth: 120 }}>
                                <Select
                                    value={selectedLanguages[item.id] || 'none'}
                                    onChange={(e) => {
                                        setSelectedLanguages(prev => ({
                                            ...prev,
                                            [item.id]: e.target.value
                                        }));
                                    }}
                                >
                                    {languageOptions.map(lang => {
                                        const codeBlocks = extractCodeBlocks(item.content?.toString() || '');
                                        const hasLanguage = codeBlocks.some(block => block.language === lang.name);
                                        return (
                                            <MenuItem key={lang.name} value={lang.name}>
                                                {lang.displayName}
                                                {hasLanguage && ' ✓'}
                                            </MenuItem>
                                        );
                                    })}
                                </Select>
                            </FormControl>
                        )}
                        {/* Markdown Preview */}
                        {selectedItems[`${item.id}-markdown`] && (
                            <Box sx={{
                                mt: 1,
                                maxHeight: 200,
                                overflow: 'auto',
                                p: 1,
                                bgcolor: 'background.paper',
                                borderRadius: 1,
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'monospace'
                            }}>
                                {previewContent[item.id] || 'Processing...'}
                            </Box>
                        )}
                    </Box>

                    {/* HTML Option */}
                    <Box>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={selectedItems[`${item.id}-html`] || false}
                                    onChange={(e) => handleSelectItem(`${item.id}-html`, e.target.checked)}
                                />
                            }
                            label="text/html"
                        />
                        {/* HTML Preview */}
                        {selectedItems[`${item.id}-html`] && (
                            <Box sx={{
                                mt: 1,
                                maxHeight: 200,
                                overflow: 'auto',
                                p: 1,
                                bgcolor: 'background.paper',
                                borderRadius: 1,
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'monospace'
                            }}>
                                {item.content?.toString()}
                            </Box>
                        )}
                    </Box>
                </Stack>
            );
        }

        // For non-HTML content
        return (
            <Box>
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={selectedItems[item.id] || false}
                            onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                        />
                    }
                    label={item.type}
                />
                {selectedItems[item.id] && item.content && (
                    <Box sx={{
                        mt: 1,
                        maxHeight: 200,
                        overflow: 'auto',
                        p: 1,
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace'
                    }}>
                        {item.content.toString()}
                    </Box>
                )}
            </Box>
        );
    };
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();

                // Check if anything is selected (including markdown/html variants)
                const hasSelections = Object.entries(selectedItems).some(([key, value]) => value) ||
                    Object.entries(selectedImages).some(([key, value]) => value);
                if (hasSelections) {
                    handleConfirm();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, data, selectedItems, selectedImages, onClose, handleConfirm]);

    const selectAllState = getSelectAllState(allItems, selectedItems, selectedImages);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: { maxHeight: DIALOG_HEIGHTS.CLIPBOARD_INSPECTOR }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                Select Content to Include
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 2 }}>
                <Stack spacing={1}>
                    <Box sx={{ mb: 1 }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={selectAllState.checked}
                                    indeterminate={selectAllState.indeterminate}
                                    onChange={() => {
                                        // If nothing or only some items are selected, select all
                                        // If all items are selected, select none
                                        const shouldSelectAll = selectAllState.selectedCount < allItems.length;
                                        handleSelectAll(shouldSelectAll);
                                    }} />
                            }
                            label="Select All Content"
                        />
                    </Box>

                    {/* Display all images first */}
                    {renderImagePreview(data.flatMap(group =>
                        group.items?.flatMap(item =>
                            collectItemImages(item)
                        ) || []
                    ))}
                    <Divider />

                    {/* Then display other content */}
                    {data.map(group =>
                        group.items?.map((item, index) => (
                            <React.Fragment key={item.id}>
                                <Box>
                                    {renderItem(item)}
                                </Box>
                                <Divider />
                            </React.Fragment>
                        ))
                    )}
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
