export interface Props {
    default?: {
        text?: string;
        images?: string[];
    };
    // force_apply_default?: boolean
    max_image_size?: number;
    placeholder?: string;
    disabled?: boolean;
    key?: string;
    debug?: string;
    clipboard_inspector_enabled?: boolean;
}
