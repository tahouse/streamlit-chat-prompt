export class PromptData {
    text: string;
    files: Array<{
        url: string;
        type: string;
        name?: string;
    }>;

    constructor(text: string = "", files: Array<{url: string, type: string, name?: string}> = []) {
        this.text = text;
        this.files = files;
    }

    static fromProps(props: any): PromptData {
        if (!props || !props.args || !props.args.default) {
            return new PromptData();
        }

        const defaultData = props.args.default;
        const files = defaultData.files?.map((file: any) => ({
            url: `data:${file.type};${file.format},${file.data}`,  // Construct proper data URL
            type: file.type,
            name: file.name || 'file'  // Use provided name or fallback
        })) || [];

        return new PromptData(
            defaultData.text || "",
            files
        );
    }

    static empty(): PromptData {
        return new PromptData();
    }

    isEmpty(): boolean {
        return !this.text && this.files.length === 0;
    }

    clone(): PromptData {
        return new PromptData(this.text, [...this.files]);
    }
}
