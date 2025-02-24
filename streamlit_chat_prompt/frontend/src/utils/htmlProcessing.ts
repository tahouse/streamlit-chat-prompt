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
    language?: string;     // Language name
    highlightHint?: string; // Syntax highlighting hint
    isInline: boolean;
    isStandalone: boolean;
}

export interface LanguageDefinition {
    name: string;
    displayName: string; // For dropdown display
    highlightHint: string;
    patterns: RegExp[];
    keywords: string[];
    indicators?: number; // Add optional indicators property
    order?: number;
}

export const LANGUAGE_DEFINITIONS: LanguageDefinition[] = [
    {
        name: 'multiple',
        displayName: 'Multiple (Keep Original)',
        highlightHint: 'multiple',
        patterns: [],
        keywords: [],
        indicators: 0,
        order: -1  // Ensure it appears near the top
    },
    {
        name: 'none',
        displayName: 'plaintext',
        highlightHint: 'plaintext',
        patterns: [],
        keywords: [],
        indicators: 0,
        order: 0
    },
    {
        name: 'python',
        displayName: 'python',
        patterns: [
            /def\s+\w+\s*\(/,
            /:\s*$/m,
            /^\s*import\s+[\w\s,]+$/m,
            /from\s+[\w.]+\s+import/,
            /\bindent|self\b/,
        ],
        keywords: ['elif', 'while', 'None', 'True', 'False', 'and', 'or', 'not'],
        highlightHint: 'python',
        indicators: 0,
        order: 1
    },
    {
        name: 'typescript',
        displayName: 'typescript',
        patterns: [
            /:\s*(string|number|boolean|any)\b/i,
            /interface\s+\w+/,
            /type\s+\w+\s*=/,
            /<[A-Z]\w*>/,
            /export\s+(type|interface|class)/,
        ],
        keywords: ['instanceof', 'readonly', 'enum', 'declare', 'namespace'],
        highlightHint: 'typescript',
        indicators: 0,
    },
    {
        name: 'javascript',
        displayName: 'javascript',
        patterns: [
            /const|let|var/,
            /=>/,
            /\.(map|filter|reduce|forEach)\(/,
            /function\s*\w*\s*\(/,
            /\$\{.*?\}/,
        ],
        keywords: ['undefined', 'console', 'Promise', 'async', 'await'],
        highlightHint: 'javascript',
        indicators: 0
    },

    {
        name: 'java',
        displayName: 'java',
        patterns: [
            /public\s+(class|interface|enum)/,
            /private|protected|public/,
            /\w+\s+\w+\s*=\s*new\s+\w+/,
            /System\.(out|err)\./,
            /import\s+java\./,
        ],
        keywords: ['extends', 'implements', 'final', 'void', 'static'],
        highlightHint: 'java',
        indicators: 0
    },
    {
        name: 'shell',
        displayName: 'shell',
        patterns: [
            /^\s*#!.*?(bash|sh|zsh)/m,
            /\$\{?\w+\}?/,
            /\|\s*grep|awk|sed/,
            /sudo|chmod|chown|echo/,
            /^\s*if\s+\[\s+.*\s+\]/m,
        ],
        keywords: ['export', 'source', 'alias', 'unset', 'local'],
        highlightHint: 'shell',
        indicators: 0
    },
    {
        name: 'markdown',
        displayName: 'markdown',
        patterns: [
            /^#{1,6}\s+.+$/m,
            /\[.+?\]\(.+?\)/,
            /^\s*[-*+]\s+/m,
            /^\s*\d+\.\s+/m,
            /`{3}.*?\n[\s\S]*?`{3}/,
        ],
        keywords: [
            '\\*\\*',
            '_\\_',
            '```',
            '>',
            '---',
            '==='
        ],
        highlightHint: 'markdown',
        indicators: 0
    },
    {
        name: 'json',
        displayName: 'json',
        patterns: [
            /^[\s\n]*{[\s\S]*}[\s\n]*$/,
            /^[\s\n]*\[[\s\S]*\][\s\n]*$/,
            /"[^"]+"\s*:/,
            /,\s*"[^"]+"\s*:/,
            /true|false|null/,
        ],
        keywords: ['{', '}', '[', ']', ':', ','],
        highlightHint: 'json',
        indicators: 0
    },
    {
        name: 'html',
        displayName: 'html',

        patterns: [
            /<[^>]+>/,
            /<\/\w+>/,
            /<!DOCTYPE\s+html>/i,
            /<(div|span|p|a|img|ul|li)\b/i,
            /\s(class|id|style)=["'][^"']*["']/
        ],
        keywords: ['html', 'head', 'body', 'div', 'span', 'class'],
        highlightHint: 'html',
        indicators: 0
    },
    {
        name: 'cpp',
        displayName: 'c++',
        patterns: [
            /#include\s*<[^>]+>/,
            /::\w+/,
            /\b(void|int|char|double)\s+\w+\s*\(/,
            /template\s*<.*?>/,
            /std::\w+/,
        ],
        keywords: ['namespace', 'template', 'class', 'public:', 'private:', 'protected:'],
        highlightHint: 'cpp',
        indicators: 0
    },
    {
        name: 'c',
        displayName: 'c',
        patterns: [
            /#include\s*<[^>]+\.h>/,
            /\b(void|int|char|float)\s+\w+\s*\([^)]*\)/,
            /\bstruct\s+\w+\s*{/,
            /malloc\s*\(|free\s*\(/,
            /printf|scanf/,
        ],
        keywords: ['sizeof', 'typedef', 'enum', 'union', 'NULL'],
        highlightHint: 'c',
        indicators: 0
    },
    {
        name: 'rust',
        displayName: 'rust',
        patterns: [
            /fn\s+\w+/,
            /let\s+mut\s+\w+/,
            /->\s*\w+/,
            /impl\s+\w+/,
            /use\s+\w+::\w+/,
        ],
        keywords: ['mut', 'impl', 'trait', 'struct', 'enum', 'match'],
        highlightHint: 'rust',
        indicators: 0
    },
    {
        name: 'sql',
        displayName: 'sql   ',
        patterns: [
            /SELECT\s+.+?\s+FROM\s+\w+/i,
            /INSERT\s+INTO\s+\w+/i,
            /UPDATE\s+\w+\s+SET/i,
            /CREATE\s+TABLE\s+\w+/i,
            /JOIN\s+\w+\s+ON/i,
        ],
        keywords: ['WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'UNION'],
        highlightHint: 'sql',
        indicators: 0
    }
];
export function getSortedLanguageOptions(detectedLanguages: Set<string>): LanguageDefinition[] {
    const hasMultipleLanguages = detectedLanguages.size > 1;

    // Create base array with fixed ordering
    const orderedOptions = [
        // Always include 'none' first
        LANGUAGE_DEFINITIONS.find(l => l.name === 'none')!,

        // Include 'multiple' option if multiple languages detected
        ...(hasMultipleLanguages ? [LANGUAGE_DEFINITIONS.find(l => l.name === 'multiple')!] : []),

        // Always include Python near the top (if it exists in LANGUAGE_DEFINITIONS)
        ...(LANGUAGE_DEFINITIONS.filter(l => l.name === 'python')),

        // Add detected languages (excluding ones we've already added)
        ...LANGUAGE_DEFINITIONS.filter(l =>
            detectedLanguages.has(l.name) &&
            l.name !== 'none' &&
            l.name !== 'multiple' &&
            l.name !== 'python'
        ),

        // Add remaining languages alphabetically
        ...LANGUAGE_DEFINITIONS.filter(l =>
            !detectedLanguages.has(l.name) &&
            l.name !== 'none' &&
            l.name !== 'multiple' &&
            l.name !== 'python'
        ).sort((a, b) => a.displayName.localeCompare(b.displayName))
    ];

    // Filter out any undefined entries and ensure unique entries
    const uniqueOptions = Array.from(new Map(
        orderedOptions
            .filter(Boolean)
            .map(lang => [lang.name, lang])
    ).values());

    // Add debugging
    Logger.debug('component', 'Language options generated:', {
        detectedLanguages: Array.from(detectedLanguages),
        hasMultipleLanguages,
        totalOptions: uniqueOptions.length,
        orderedNames: uniqueOptions.map(l => l.name)
    });

    return uniqueOptions;
}
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createKeywordRegex(keyword: string): RegExp {
    const escaped = escapeRegExp(keyword);
    try {
        return new RegExp(`\\b${escaped}\\b`, 'g');
    } catch (e) {
        // Fallback for keywords that can't be used with word boundaries
        return new RegExp(escaped, 'g');
    }
}
export function guessCodeLanguage(code: string): { name: string; highlightHint: string } {
    // Clean and normalize the code sample
    const normalizedCode = code.trim();

    // Language patterns with distinctive features
    const languages = LANGUAGE_DEFINITIONS.filter(lang => lang.name !== 'none').map(lang => ({
        ...lang,
        indicators: 0 // Ensure indicators is initialized
    }));

    // Calculate confidence scores for each language
    languages.forEach(lang => {
        // Check patterns
        lang.patterns.forEach(pattern => {
            try {
                if (pattern.test(normalizedCode)) {
                    lang.indicators += 2;
                }
            } catch (e) {
                Logger.warn('component', `Invalid pattern in ${lang.name}:`, e);
            }
        });

        // Check keywords with safe regex creation
        lang.keywords.forEach(keyword => {
            try {
                const regex = createKeywordRegex(keyword);
                const matches = normalizedCode.match(regex);
                if (matches) {
                    lang.indicators += matches.length;
                }
            } catch (e) {
                Logger.warn('component', `Invalid keyword in ${lang.name}: ${keyword}`, e);
            }
        });

        // Special case checks
        switch (lang.name) {
            case 'typescript':
                if (normalizedCode.includes('typescript')) lang.indicators += 3;
                break;
            case 'python':
                if (/^\s*def\s+\w+\s*\([^)]*\)\s*:/.test(normalizedCode)) lang.indicators += 3;
                break;
            case 'shell':
                if (/^\s*#!.*?\/bin\/(bash|sh)/.test(normalizedCode)) lang.indicators += 5;
                break;
            case 'java':
                if (/class\s+\w+\s*(extends|implements)/.test(normalizedCode)) lang.indicators += 3;
                break;
            case 'markdown':
                if (/^#\s+/.test(normalizedCode)) lang.indicators += 3;
                break;
            case 'json':
                // eslint-disable-next-line no-useless-escape
                if (/^[\s\n]*[{\[]/.test(normalizedCode) && /[}\]][\s\n]*$/.test(normalizedCode)) lang.indicators += 3;
                break;
            case 'html':
                if (/<\/?[a-z][\s\S]*>/i.test(normalizedCode)) lang.indicators += 3;
                break;
        }
    });

    // Sort languages by confidence score
    // Sort languages by confidence score
    languages.sort((a, b) => (b.indicators || 0) - (a.indicators || 0));

    // Return the most likely language if it has enough indicators
    if (languages[0]?.indicators >= 2) {
        Logger.debug('component', 'Language detection:', {
            detected: languages[0].name,
            confidence: languages[0].indicators,
            allScores: languages.map(l => ({ [l.name]: l.indicators }))
        });
        return {
            name: languages[0].name,
            highlightHint: languages[0].highlightHint || languages[0].name
        };
    }

    // Fallback detection based on specific patterns
    if (normalizedCode.includes('=>')) return { name: 'javascript', highlightHint: 'javascript' };
    if (normalizedCode.includes('def ')) return { name: 'python', highlightHint: 'python' };
    if (normalizedCode.startsWith('#include')) return { name: 'cpp', highlightHint: 'cpp' };
    if (normalizedCode.startsWith('fn ')) return { name: 'rust', highlightHint: 'rust' };
    if (normalizedCode.toUpperCase().includes('SELECT') &&
        normalizedCode.toUpperCase().includes('FROM')) return { name: 'sql', highlightHint: 'sql' };
    if (normalizedCode.startsWith('#')) return { name: 'markdown', highlightHint: 'markdown' };
    if (normalizedCode.trim().startsWith('{') &&
        normalizedCode.trim().endsWith('}')) return { name: 'json', highlightHint: 'json' };

    // Default to javascript if we can't determine
    return { name: 'plaintext', highlightHint: 'plaintext' };
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
    Logger.debug("component", "Checking if code block is inline:", {
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

export function stripHtmlStyling(html: string): string {

    const cleanHtml = html
        .replace(/<!--[\s\S]*?(?:@font-face|Style Definitions)[\s\S]*?-->/gi, '') // Remove font/style definition blocks
        .replace(/<o:p>\s*<\/o:p>/g, '') // Remove empty o:p tags
        .replace(/<\/?\w+:[^>]*>/g, '')  // Remove all other namespace tags
        .replace(/style="[^"]*"/g, '')   // Remove style attributes
        .replace(/class="Mso[^"]*"/g, '') // Remove MSO classes
        .replace(/<!--[\s\S]*?-->/g, ''); // Remove any remaining comments

    if (html !== cleanHtml) {
        Logger.debug("component", "Cleaned Microsoft Word HTML:", {
            originalLength: html.length,
            originalHtml: html.slice(0, 100),
            cleanedLength: cleanHtml.length,
            cleanedHtml: cleanHtml.slice(0, 100)
        });
        return cleanHtml;
    } else {
        Logger.debug("component", "Did not find any Microsoft Word HTML to clean.", {
            originalLength: html.length,
            cleanedLength: cleanHtml.length,
        });
        return html;
    }
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
                style: element.getAttribute('style'),
                text: element.textContent
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
            const detectedLanguage = guessCodeLanguage(decodedPlainText);


            codeBlocks.push({
                html: element.innerHTML,       // Original HTML
                plainText: decodedPlainText,   // Clean text with preserved whitespace
                language: detectedLanguage.name,
                highlightHint: detectedLanguage.highlightHint,
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