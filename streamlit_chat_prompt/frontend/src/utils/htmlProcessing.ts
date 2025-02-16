// utils/htmlProcessing.ts
import { Logger } from './logger';

export interface ExtractedImage {
    file: File;
    originalUrl: string;
}

export async function extractImagesFromHtml(html: string): Promise<ExtractedImage[]> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images: ExtractedImage[] = [];

    // Process regular images
    const imgElements = doc.getElementsByTagName('img');
    for (const img of Array.from(imgElements)) {
        const src = img.src;
        if (src) {
            try {
                const response = await fetch(src);
                const blob = await response.blob();
                const filename = src.split('/').pop() || 'image.png';
                const file = new File([blob], filename, { type: blob.type });
                images.push({ file, originalUrl: src });
            } catch (error) {
                Logger.warn('images', `Failed to fetch image from ${src}:`, error);
            }
        }
    }

    // Process SVG elements
    const svgElements = doc.getElementsByTagName('svg');
    for (const svg of Array.from(svgElements)) {
        try {
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svg);
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const file = new File([blob], 'image.svg', { type: 'image/svg+xml' });
            images.push({ file, originalUrl: 'inline-svg' });
        } catch (error) {
            Logger.warn('images', 'Failed to convert SVG:', error);
        }
    }

    // Process background images
    const elementsWithBg = doc.querySelectorAll('[style*="background-image"]');
    for (const el of Array.from(elementsWithBg)) {
        const style = window.getComputedStyle(el);
        const bgUrl = style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/)?.[1];
        if (bgUrl) {
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

    return images;
}