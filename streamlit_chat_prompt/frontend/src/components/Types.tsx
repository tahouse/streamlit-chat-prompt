export type FileType = 'image' | 'document'; // | 'audio';

export interface SupportedFile {
  file: File;
  type: FileType;
  preview?: string;
  size: number;
}

export const PREVIEWABLE_MIME_TYPES = [
  'text/markdown',
  'text/plain',
  'text/html',
  'text/csv',
  'application/json'
] as string[];

export const PREVIEWABLE_EXTENSIONS = [
  '.md', 
  '.txt', 
  '.html', 
  '.htm', 
  '.csv', 
  '.json'
] as string[];

// Define file extensions and MIME types for each file type
const FILE_DEFINITIONS = {
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
  },
  document: {
    mimeTypes: [
      // PDF
      'application/pdf',
      // Markdown
      'text/markdown', 
      'text/x-markdown',
      // Word
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Excel
      'application/vnd.ms-excel', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // PowerPoint
      'application/vnd.ms-powerpoint', 
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Other text formats
      'text/csv',
      'text/html',
      'text/plain',
      'application/rtf',
      'application/json'
    ],
    extensions: [
      // PDF
      '.pdf',
      // Markdown 
      '.md',
      // Office formats
      '.doc', '.docx', 
      '.xls', '.xlsx', 
      '.ppt', '.pptx',
      // Other formats 
      '.csv', 
      '.html', '.htm', 
      '.txt', 
      '.rtf', 
      '.json'
    ]
  }
};

// Create the FILE_TYPE_MAP from FILE_DEFINITIONS
export const FILE_TYPE_MAP: Record<string, FileType> = {};
Object.entries(FILE_DEFINITIONS).forEach(([type, def]) => {
  def.mimeTypes.forEach(mime => {
    FILE_TYPE_MAP[mime] = type as FileType;
  });
});

// Helper function to get file type from MIME type or filename
export function getFileType(file: File): FileType {
  // First check by MIME type
  if (file.type in FILE_TYPE_MAP) {
    return FILE_TYPE_MAP[file.type];
  }
  
  // Then check by file extension for cases where MIME type is ambiguous
  const filename = file.name.toLowerCase();
  
  // Check each file type's extensions
  for (const [type, def] of Object.entries(FILE_DEFINITIONS)) {
    for (const ext of def.extensions) {
      if (filename.endsWith(ext)) {
        return type as FileType;
      }
    }
  }
  
  // Default to document if we can't identify type
  return 'document';
}

// Maintained for backward compatibility
export const SUPPORTED_FILE_TYPES = {
  IMAGE: FILE_DEFINITIONS.image.mimeTypes,
  DOCUMENT: FILE_DEFINITIONS.document.mimeTypes,
  // Include these for backward compatibility if needed
  PDF: FILE_DEFINITIONS.document.mimeTypes.filter(mime => mime === 'application/pdf'),
  MARKDOWN: FILE_DEFINITIONS.document.mimeTypes.filter(mime => 
    mime === 'text/markdown' || mime === 'text/x-markdown'
  )
};

// Generate accept string for file input
export function getAcceptedFileString(): string {
  const accepts = ['image/*'];
  
  // Add all extensions except image (covered by image/*)
  for (const [type, def] of Object.entries(FILE_DEFINITIONS)) {
    if (type !== 'image') {
      accepts.push(...def.extensions);
    }
  }
  
  return accepts.join(',');
}

// Check if a file type is supported
export function isValidFileType(file: File): boolean {
  // First check by MIME type
  if (file.type in FILE_TYPE_MAP) return true;
  
  // Then check by extension
  const filename = file.name.toLowerCase();
  
  // Check all extensions from FILE_DEFINITIONS
  for (const def of Object.values(FILE_DEFINITIONS)) {
    for (const ext of def.extensions) {
      if (filename.endsWith(ext)) {
        return true;
      }
    }
  }
  
  return false;
}

export function isPreviewableDocument(file: File): boolean {
  // Images are always previewable
  if (file.type.startsWith('image/')) {
    return true;
  }

  // Check MIME type first
  if (PREVIEWABLE_MIME_TYPES.includes(file.type)) {
    return true;
  }

  // Fallback to extension check
  const filename = file.name.toLowerCase();
  return PREVIEWABLE_EXTENSIONS.some(ext => filename.endsWith(ext));
}