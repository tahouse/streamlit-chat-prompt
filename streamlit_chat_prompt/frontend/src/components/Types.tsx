export interface SupportedFile {
  file: File;
  type: 'image' | 'pdf' | 'markdown' | 'audio';
  preview?: string;
}

export const SUPPORTED_FILE_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  PDF: ['application/pdf'],
  MARKDOWN: ['text/markdown', 'text/x-markdown', 'text/plain'],
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg']
};