export class PromptData {
    text: string;
    images: string[];

    constructor(text: string = "", images: string[] = []) {
        this.text = text;
        this.images = images;
    }

    static fromProps(props: any): PromptData {
        if (!props || !props.args || !props.args.default) {
            return new PromptData();
        }

        const defaultData = props.args.default;
        return new PromptData(
            defaultData.text || "",
            Array.isArray(defaultData.images) ? defaultData.images : []
        );
    }

    static empty(): PromptData {
        return new PromptData();
    }

    isEmpty(): boolean {
        return !this.text && this.images.length === 0;
    }

    clone(): PromptData {
        return new PromptData(this.text, [...this.images]);
    }
}
