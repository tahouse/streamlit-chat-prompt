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
}
function isInlineCode(element: Element): boolean {
    // Check if code is within paragraph text
    const isInParagraph = !!element.closest('p');
    // Check if there are any line breaks in the content
    const hasLineBreaks = element.textContent?.includes('\n');
    // Check if it's a single short segment
    const isShortSegment = (element.textContent?.length || 0) < 40;

    return (isInParagraph || isShortSegment) && !hasLineBreaks;
}
export function decodeHtmlEntities(html: string): string {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
}
export function isCodeBlock(element: Element): boolean {
    if (!(element instanceof HTMLElement)) return false;

    // Get computed or inline styles
    const fontFamily = element.style.fontFamily || window.getComputedStyle(element).fontFamily;
    const whiteSpace = element.style.whiteSpace || window.getComputedStyle(element).whiteSpace;

    // Check for common code editor fonts and pre-formatted text indicators
    const isMonospace = /(monospace|menlo|monaco|consolas|courier|source code)/i.test(fontFamily);
    const isPreFormatted = whiteSpace === 'pre' || element.tagName === 'PRE' || element.tagName === 'CODE';

    Logger.debug("component", "Code block check:", {
        element: element.tagName,
        fontFamily,
        whiteSpace,
        isMonospace,
        isPreFormatted
    });

    return isMonospace && isPreFormatted;
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
            Logger.info("component", "Found code block:", {
                element: element.tagName,
                classes: element.className,
                style: element.getAttribute('style')
            });

            // Language detection logic (unchanged)
            let language: string | undefined;
            const classes = element.className.split(' ');
            const langClass = classes.find(c => c.startsWith('language-'));
            if (langClass) {
                language = langClass.replace('language-', '');
            }

            // VS Code detection logic (unchanged)
            if (!language && element.innerHTML.includes('class="')) {
                if (element.innerHTML.includes('keyword') ||
                    element.innerHTML.includes('function') ||
                    element.innerHTML.includes('operator')) {
                    if (element.innerHTML.includes('def ') || element.innerHTML.includes('class ')) {
                        language = 'python';
                    } else if (element.innerHTML.includes('function ')) {
                        language = 'javascript';
                    }
                }
            }

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
                language: language,
                isInline: isInline
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


export async function extractImagesFromHtml(html: string): Promise<ExtractedImage[]> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images: ExtractedImage[] = [];

    // Get all elements that could contain images in document order
    const elements = Array.from(doc.body.querySelectorAll('*'));

    for (const element of elements) {
        // Process <img> elements
        if (element instanceof HTMLImageElement) {
            const src = element.src;
            if (src) {
                try {
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
                        throw proxyError || new Error('All proxies failed');
                    }

                    const blob = await response.blob();
                    const filename = src.split('/').pop() || 'image.png';
                    const file = new File([blob], filename, { type: blob.type || 'image/png' });

                    images.push({
                        file,
                        originalUrl: src
                    });

                } catch (error) {
                    Logger.warn('images', `Failed to load image from ${src}:`, error);
                    const placeholderBlob = new Blob(['[Image could not be loaded]'], { type: 'text/plain' });
                    const placeholderFile = new File([placeholderBlob], 'failed-image.txt', { type: 'text/plain' });
                    images.push({
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
                const blob = new Blob([svgString], { type: 'image/svg+xml' });
                const file = new File([blob], 'image.svg', { type: 'image/svg+xml' });
                images.push({ file, originalUrl: 'inline-svg' });
            } catch (error) {
                Logger.warn('images', 'Failed to convert SVG:', error);
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
                    images.push({ file, originalUrl: bgUrl });
                } catch (error) {
                    Logger.warn('images', `Failed to fetch background image from ${bgUrl}:`, error);
                }
            }
        }
    }

    return images;
}