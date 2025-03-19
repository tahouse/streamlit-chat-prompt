export interface BaseFileUploadLimits {
    max_size_in_bytes?: number;
    max_count?: number;
}

export interface ImageFileUploadLimits extends BaseFileUploadLimits {
    max_dimension_in_pixels?: number;
}

export interface Props {
    default?: {
        text?: string;
        images?: string[];
    };
    // force_apply_default?: boolean
    image_file_upload_limits?: ImageFileUploadLimits;
    document_file_upload_limits?: BaseFileUploadLimits;
    placeholder?: string;
    disabled?: boolean;
    key?: string;
    debug?: string;
    clipboard_inspector_enabled?: boolean;
}
