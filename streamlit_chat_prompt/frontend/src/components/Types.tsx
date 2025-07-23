export type FileType = 'image' | 'pdf' | 'markdown' | 'document'; // | 'audio';

export interface SupportedFile {
  file: File;
  type: FileType;
  preview?: string;
  size: number;
}

// Define file extensions and MIME types for each file type
const FILE_DEFINITIONS = {
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
  },
  pdf: {
    mimeTypes: ['application/pdf'],
    extensions: ['.pdf']
  },
  markdown: {
    mimeTypes: ['text/markdown', 'text/x-markdown'],
    extensions: ['.md']
  },
  document: {
    mimeTypes: [
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/csv',
      'text/html',
      'text/plain',
      'application/rtf',
      'application/json'
    ],
    extensions: [
      '.doc', '.docx', 
      '.xls', '.xlsx', 
      '.ppt', '.pptx', 
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
  PDF: FILE_DEFINITIONS.pdf.mimeTypes,
  MARKDOWN: FILE_DEFINITIONS.markdown.mimeTypes,
  DOCUMENT: FILE_DEFINITIONS.document.mimeTypes
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