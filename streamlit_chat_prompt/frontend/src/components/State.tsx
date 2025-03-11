import { ClipboardInspectorData } from "./ClipboardInspector";
import { SupportedFile } from './Types';

export interface State {
    uuid: string;
    text: string;
    images: File[]; // Keep this for backward compatibility
    files: SupportedFile[];
    isFocused: boolean;
    disabled: boolean;
    userHasInteracted: boolean;
    lastSubmissionTime: number;
    notification: {
        open: boolean;
        message: string;
        severity: "error" | "warning" | "info";
    };
    clipboardInspector: {
        open: boolean;
        data: ClipboardInspectorData[];
        loading: boolean;
    };
  }
