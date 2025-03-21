export interface SupportedFile {
  file: File;
  type: 'image' | 'pdf' | 'markdown'; // | 'audio';
  preview?: string;
  size: number;
}

export const SUPPORTED_FILE_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  PDF: ['application/pdf'],
  MARKDOWN: ['text/markdown', 'text/x-markdown', 'text/plain', 'application/x-markdown'],
  // AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg']
};

export function getAcceptedFileString(): string {
  const accepts = [
    'image/*', ".md", ".pdf",
    ...SUPPORTED_FILE_TYPES.PDF,
    ...SUPPORTED_FILE_TYPES.MARKDOWN
    // ... SUPPORTED_FILE_TYPES.AUDIO
  ];
  
  return accepts.join(',');
}