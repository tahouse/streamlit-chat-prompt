import { Logger } from "./logger";


export function generateUUID(): string {
    Logger.debug("events", "Generating UUID");
    // Try native crypto.randomUUID() first
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback for older browsers
    const getRandomHex = () => {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    };

    const hex = getRandomHex();
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        "4" + hex.slice(13, 16),
        "8" + hex.slice(17, 20),
        hex.slice(20, 32),
    ].join("-");
};