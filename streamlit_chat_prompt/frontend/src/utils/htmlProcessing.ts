// utils/htmlProcessing.ts
import { Logger } from './logger';

export interface ExtractedImage {
    file: File;
    originalUrl: string;
    error?: string;
}

interface CodeBlock {
    html: string;          // Original HTML
    plainText: string;     // Clean text with preserved whitespace
    language?: string;
    isInline: boolean;
    isStandalone: boolean;
}

function isStandaloneBlock(element: Element): boolean {
    // If it's a <code> element not in a <pre>, it's not standalone
    if (element.tagName === 'CODE' && !element.closest('pre')) {
        return false;
    }

    // Check if element is direct child of body or another block-level container
    const isTopLevel = element.parentElement?.tagName === 'BODY';

    // Check if it's the only major content in its container
    const siblings = Array.from(element.parentElement?.children || []);
    const hasOnlyWhitespaceOrEmptySiblings = siblings.every(sibling =>
        sibling === element ||
        (sibling.textContent || '').trim() === '' ||
        sibling.tagName === 'BR'
    );

    // Check if surrounded by empty lines in text content
    const prevSibling = element.previousSibling;
    const nextSibling = element.nextSibling;
    const hasSurroundingWhitespace =
        (!prevSibling || prevSibling.textContent?.trim() === '') &&
        (!nextSibling || nextSibling.textContent?.trim() === '');

    return isTopLevel || (hasOnlyWhitespaceOrEmptySiblings && hasSurroundingWhitespace);
}

function isInlineCode(element: Element): boolean {
    const isInParagraph = !!element.closest('p');
    const hasLineBreaks = element.textContent?.includes('\n');
    const isShortSegment = (element.textContent?.length || 0) < 40;
    const standalone = isStandaloneBlock(element);
    const isCodeElement = element.tagName === 'CODE';
    const isInPreBlock = !!element.closest('pre');

    // add labels
    Logger.info("component", "Checking if code block is inline:", {
        text: element.textContent,
        isInParagraph: isInParagraph,
        hasLineBreaks: hasLineBreaks,
        isShortSegment: isShortSegment,
        standalone: standalone,
        isCodeElement: isCodeElement,
        isInPreBlock: isInPreBlock
    }
    )
    // If it's standalone, it's not inline regardless of other factors
    if (standalone) {
        return false;
    }

    // If it's a <code> element not inside a <pre>, treat as inline
    if (isCodeElement && !isInPreBlock) {
        return true;
    }

    return (isInParagraph || isShortSegment) && !hasLineBreaks;
}

export function decodeHtmlEntities(html: string): string {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
}

export function isCodeBlock(element: Element): boolean {
    if (!(element instanceof HTMLElement)) return false;

    // Check for PRE and CODE tags first
    if (element.tagName === 'PRE' || element.tagName === 'CODE') {
        return true;
    }

    // Then check styles as backup
    const fontFamily = element.style.fontFamily || window.getComputedStyle(element).fontFamily;
    const whiteSpace = element.style.whiteSpace || window.getComputedStyle(element).whiteSpace;

    const isMonospace = /(monospace|menlo|monaco|consolas|courier|source code)/i.test(fontFamily);
    const isPreFormatted = whiteSpace === 'pre';

    return isMonospace || isPreFormatted;
}

export function extractCodeBlocks(html: string): CodeBlock[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const codeBlocks: CodeBlock[] = [];

    function processElement(element: Element) {
        if (element.tagName === 'BODY') {
            Array.from(element.children).forEach(processElement);
            return;
        }

        if (isCodeBlock(element)) {
            Logger.debug("component", "Found code block:", {
                element: element.tagName,
                classes: element.className,
                style: element.getAttribute('style')
            });

            // Create cleaned plaintext version
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = element.innerHTML;
            const plainText = tempDiv.innerHTML
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<div>/gi, '\n')
                .replace(/<\/div>/gi, '')
                .replace(/<p>/gi, '\n')
                .replace(/<\/p>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/\r\n/g, '\n')
                .replace(/\n\s*\n\s*\n/g, '\n\n');

            // Decode HTML entities in plaintext
            const decodedPlainText = decodeHtmlEntities(plainText).trim();
            const isInline = isInlineCode(element);

            codeBlocks.push({
                html: element.innerHTML,       // Original HTML
                plainText: decodedPlainText,   // Clean text with preserved whitespace
                isInline: isInline,
                isStandalone: isStandaloneBlock(element)
            });

            // Replace with placeholder (unchanged)
            const placeholder = document.createElement('p');
            placeholder.textContent = `[code-block-${codeBlocks.length - 1}]`;
            element.replaceWith(placeholder);
            return;
        }

        Array.from(element.children).forEach(processElement);
    }

    processElement(doc.body);
    Logger.debug("component", "Extracted code blocks:", codeBlocks);
    return codeBlocks;
}

async function tryImageFetch(src: string): Promise<Response> {
    const isLocalStreamlit = src.startsWith('http://localhost:8501/');

    if (isLocalStreamlit) {
        // For Streamlit resources, use no-cors immediately
        // since we can't modify Streamlit's CORS headers
        return fetch(src, {
            mode: 'no-cors',
            credentials: 'include',
            headers: {
                'Accept': 'image/*'
            }
        });
    }

    // For non-local resources, try normal fetch first
    try {
        const response = await fetch(src, {
            mode: 'cors',
            credentials: 'same-origin'
        });
        if (!response.ok && response.status !== 304) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response;
    } catch (error) {
        throw error;
    }
}

export async function extractImagesFromHtml(html: string): Promise<ExtractedImage[]> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const regularImages: ExtractedImage[] = [];
    const svgImages: ExtractedImage[] = [];


    // Get all elements that could contain images in document order
    const elements = Array.from(doc.body.querySelectorAll('*'));

    for (const element of elements) {
        // Process <img> elements
        if (element instanceof HTMLImageElement) {
            const src = element.src;
            if (src) {
                try {
                    // Handle base64 encoded images
                    if (src.startsWith('data:image/')) {
                        const mimeType = src.split(';')[0].split(':')[1];
                        const base64Data = src.split(',')[1];
                        const byteCharacters = atob(base64Data);
                        const byteNumbers = new Array(byteCharacters.length);

                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }

                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: mimeType });
                        const filename = `inline-image-${regularImages.length}.${mimeType.split('/')[1]}`;
                        const file = new File([blob], filename, { type: mimeType });

                        regularImages.push({
                            file,
                            originalUrl: `[embedded-image-${regularImages.length}]` // Use placeholder as reference
                        });
                        continue;
                    }

                    // Try direct download first
                    try {
                        Logger.debug('images', `Attempting to fetch ${src}`);
                        const response = await tryImageFetch(src);

                        // Even with no-cors (opaque response), we can still get the blob
                        const blob = await response.blob();
                        if (blob.size > 0) {
                            const filename = src.split('/').pop() || 'image.png';
                            const file = new File([blob], filename, { type: blob.type || 'image/png' });
                            regularImages.push({
                                file,
                                originalUrl: src
                            });
                            continue;
                        }

                        throw new Error('Retrieved blob was empty');
                    } catch (error) {
                        if (src.startsWith('http://localhost:8501/')) {
                            Logger.warn('images', `Failed to load local Streamlit file: ${src}`, error);
                            continue; // Skip proxy attempts for local files
                        }
                        Logger.debug('images', `Direct download failed for ${src}, trying proxies`, error);
                    }

                    // Fall back to proxies if direct download fails
                    const corsProxies = [
                        (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
                        (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
                        (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
                    ];

                    let response: Response | null = null;
                    let proxyError: Error | null = null;

                    for (const proxyUrl of corsProxies) {
                        try {
                            Logger.debug('images', `Trying proxy for ${src}: ${proxyUrl(src)}`);
                            response = await fetch(proxyUrl(src));
                            if (response.ok) break;
                        } catch (error) {
                            proxyError = error as Error;
                            continue;
                        }
                    }

                    if (!response?.ok) {
                        throw proxyError || new Error('All download attempts failed');
                    }

                    const blob = await response.blob();
                    const filename = src.split('/').pop() || 'image.png';
                    const file = new File([blob], filename, { type: blob.type || 'image/png' });

                    regularImages.push({
                        file,
                        originalUrl: src
                    });

                } catch (error) {
                    Logger.warn('images', `Failed to load image from ${src}:`, error);
                    const placeholderBlob = new Blob(['[Image could not be loaded]'], { type: 'text/plain' });
                    const placeholderFile = new File([placeholderBlob], 'failed-image.txt', { type: 'text/plain' });
                    regularImages.push({
                        file: placeholderFile,
                        originalUrl: src,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }
        }
        // Process SVG elements
        else if (element instanceof SVGElement && element.tagName.toLowerCase() === 'svg') {
            try {
                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(element);

                // Get SVG dimensions from viewBox or attributes
                const viewBox = element.getAttribute('viewBox')?.split(' ').map(Number);
                const width = Math.max(
                    (element as SVGSVGElement).width?.baseVal?.value || 0,
                    viewBox?.[2] || 0,
                    element.getAttribute('width') ? parseInt(element.getAttribute('width')!) : 0
                ) || 800; // fallback width
                const height = Math.max(
                    (element as SVGSVGElement).height?.baseVal?.value || 0,
                    viewBox?.[3] || 0,
                    element.getAttribute('height') ? parseInt(element.getAttribute('height')!) : 0
                ) || 600; // fallback height

                // Create a new SVG with explicit dimensions
                const wrappedSvg = `
                    <svg xmlns="http://www.w3.org/2000/svg" 
                         width="${width}" 
                         height="${height}" 
                         viewBox="0 0 ${width} ${height}">
                        ${svgString}
                    </svg>`;

                const svgBlob = new Blob([wrappedSvg], { type: 'image/svg+xml' });
                const svgUrl = URL.createObjectURL(svgBlob);

                // Convert SVG to PNG using canvas
                const img = new Image();
                await new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = reject;
                    img.src = svgUrl;
                });

                // Create canvas with proper dimensions
                const canvas = document.createElement('canvas');
                const scale = 5; // Scale up for better quality
                canvas.width = width * scale;
                canvas.height = height * scale;

                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Could not get canvas context');

                // Scale up for better quality
                ctx.scale(scale, scale);
                ctx.fillStyle = 'transparent';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to PNG
                const pngDataUrl = canvas.toDataURL('image/png');

                // Clean up
                URL.revokeObjectURL(svgUrl);

                // Convert data URL to File
                const base64Data = pngDataUrl.split(',')[1];
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);

                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }

                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/png' });
                const filename = `inline-svg-${svgImages.length}.png`;
                const file = new File([blob], filename, { type: 'image/png' });

                svgImages.push({
                    file,
                    originalUrl: 'inline-svg'
                });

            } catch (error) {
                Logger.warn('images', 'Failed to convert SVG to PNG:', error);
            }
        }
        // Process background images
        else {
            const style = window.getComputedStyle(element);
            const bgUrl = style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/)?.[1];
            if (bgUrl && bgUrl !== 'none') {
                try {
                    const response = await fetch(bgUrl);
                    const blob = await response.blob();
                    const filename = bgUrl.split('/').pop() || 'background.png';
                    const file = new File([blob], filename, { type: blob.type });
                    regularImages.push({ file, originalUrl: bgUrl });
                } catch (error) {
                    Logger.warn('images', `Failed to fetch background image from ${bgUrl}:`, error);
                }
            }
        }
    }

    return [...regularImages, ...svgImages];
}

export function cleanBase64ImagesFromContent(content: string, imageCount: number): string {
    let cleanContent = content;
    let currentIndex = 0; // Start from the provided count

    // Match markdown image tags with base64 data
    const regex = /!\[.*?\]\(data:image\/[^;]+;base64,[^)]+\)/g;

    let match;
    while ((match = regex.exec(cleanContent)) !== null) {
        // Replace with numbered reference using currentIndex
        const placeholder = `![image-${currentIndex}][${currentIndex}]`;
        cleanContent = cleanContent.replace(match[0], placeholder);
        currentIndex++;
    }

    // Also handle regular image URLs
    const urlRegex = /!\[.*?\]\((https?:\/\/[^)]+)\)/g;
    while ((match = urlRegex.exec(cleanContent)) !== null) {
        const placeholder = `![image-${currentIndex}][${currentIndex}]`;
        cleanContent = cleanContent.replace(match[0], placeholder);
        currentIndex++;
    }

    return cleanContent;
}