import { Logger } from "../utils/logger";

export async function checkFileSize(file: File, maxSize: number): Promise<{
    isValid: boolean;
    fileSize: number;
    base64Size: number;
}> {
    // Get base64 size
    const base64Size = await new Promise<number>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            resolve(base64String.length);
        };
        reader.readAsDataURL(file);
    });

    const fileSize = file.size;
    const isValid =
        base64Size <= maxSize && fileSize <= maxSize;

    Logger.debug("images", "File size check", {
        fileName: file.name,
        fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
        base64Size: `${(base64Size / 1024 / 1024).toFixed(2)}MB`,
        maxSize: `${(maxSize / 1024 / 1024).toFixed(2)}MB`,
        isValid,
    });

    return {
        isValid,
        fileSize,
        base64Size,
    };
}

export async function processImage(file: File, maxSize: number): Promise<File | null> {
    Logger.debug("images", "Processing image", file.name, {
        originalSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        type: file.type,
    });

    // Check if the original file is already small enough
    const initialSizeCheck = await checkFileSize(file, maxSize);
    if (initialSizeCheck.isValid) {
        Logger.debug(
            "images",
            "Image already under size limit, returning original"
        );
        return file;
    }

    const img = new Image();
    const imgUrl = URL.createObjectURL(file);

    try {
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imgUrl;
        });
        Logger.debug("images", "Image loaded:", {
            originalDimensions: `${img.width}x${img.height}`,
        });

        // Try compression only first
        for (const quality of [1.0, 0.9, 0.8, 0.7]) {
            Logger.debug("images", "Trying compression only with quality", quality);
            const result = await compressImage(img, quality, 1.0);
            const sizeCheck = await checkFileSize(result, maxSize);
            if (sizeCheck.isValid) {
                Logger.debug("images", "Successfully compressed without scaling");
                return result;
            }
        }

        // If compression alone didn't work, try scaling down
        let scale = 0.9;
        for (let attempt = 0; attempt < 5; attempt++) {
            Logger.debug(
                "images",
                `Trying scaling with scale=${scale.toFixed(2)} and quality=0.8`
            );
            const result = await compressImage(img, 0.8, scale);
            const sizeCheck = await checkFileSize(result, maxSize);
            if (sizeCheck.isValid) {
                Logger.debug("images", "Successfully compressed with scaling");
                return result;
            }
            scale *= 0.8;
        }
        Logger.warn(
            "images",
            "Failed to compress image below size limit after all attempts"
        );
        return null;
    } catch (err) {
        Logger.error("images", "Error processing image", err);
        throw err;
    } finally {
        URL.revokeObjectURL(imgUrl);
    }
}

export async function compressImage(
    img: HTMLImageElement,
    quality: number,
    scale: number
): Promise<File> {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    Logger.debug("images", "Compressing image:", {
        quality,
        scale,
        canvasDimensions: `${canvas.width}x${canvas.height}`,
    });

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
            (blob) => {
                Logger.debug("images", "Blob created:", {
                    size: `${(blob!.size / 1024 / 1024).toFixed(2)}MB`,
                    type: "image/jpeg",
                });
                resolve(blob!);
            },
            "image/jpeg",
            quality
        );
    });

    const result = new File([blob], "compressed.jpg", { type: "image/jpeg" });
    Logger.debug("images", "Compression complete:", {
        inputDimensions: `${img.width}x${img.height}`,
        outputDimensions: `${canvas.width}x${canvas.height}`,
        quality,
        scale,
        finalSize: `${(result.size / 1024 / 1024).toFixed(2)}MB`,
    });

    return result;
}
