import { ClipboardInspectorData } from "./ClipboardInspector";

export interface State {
    uuid: string;
    text: string;
    images: File[];
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
