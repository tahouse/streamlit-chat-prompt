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

function checkValidImageDimensions(img: HTMLImageElement, maxPixelDimension: number = 8000): boolean {
    return img.width <= maxPixelDimension && img.height <= maxPixelDimension;
}
export async function processImage(file: File, maxFileSize: number, maxPixelDimension: number = 8000): Promise<File | null> {
    const img = new Image();
    const imgUrl = URL.createObjectURL(file);

    try {
        // Wait for image to load to get dimensions
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imgUrl;
        });

        Logger.debug("images", "Processing image", file.name, {
            originalFileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
            originalDimensions: `${img.width}x${img.height}`,
            type: file.type,
        });

        // Check if image already within limits
        let dimensionCheck = checkValidImageDimensions(img, maxPixelDimension)
        let sizeCheck = (await checkFileSize(file, maxFileSize)).isValid;
        let initialScale = 1.0;

        if (dimensionCheck && sizeCheck) {
            Logger.debug("images", "Image is already within limits, no need to compress or scale");
            return file;
        } else {
            let result: File | null = null;

            if (!dimensionCheck) {
                Logger.debug("images", "Image dimensions exceed maximum, will need to scale");

                // Calculate initial scale based on dimensions if needed
                // by default, no scaling is needed
                const currentMaxImageDimension = Math.max(img.width, img.height);
                if (currentMaxImageDimension > maxPixelDimension) {
                    // we must scale down if the image is too large vs maxPixelDimension
                    initialScale = maxPixelDimension / currentMaxImageDimension;
                    Logger.debug("images", `Image requires initial scaling: ${initialScale.toFixed(2)} due to large dimensions`);
                }
            }

            // Try compression                
            for (const quality of [1.0, 0.9, 0.8, 0.7]) {
                Logger.debug("images", `Attempting to lower compress image with quality (${quality}) and scaling ${initialScale}`);
                result = await compressImage(img, quality, initialScale);
                sizeCheck = (await checkFileSize(result, maxFileSize)).isValid;
                if (sizeCheck) {
                    // update text if we needed to scale or not
                    if (initialScale < 1.0) {
                        Logger.debug("images", `Successfully compressed (${quality}) and scaled ${initialScale} image`);
                    } else {
                        Logger.debug("images", `Successfully compressed (${quality}) image`);
                    }
                    return result;
                }
            }

            // If we're here, compression alone didn't work

            // Start with necessary dimension-based scaling (or 1.0 if no dimension issues)
            let scale = initialScale;

            // Progressive compression and scaling
            const qualityLevels = [0.9, 0.8, 0.7, 0.6];

            for (const quality of qualityLevels) {
                // Try with current scale and this quality
                Logger.debug("images", `Trying quality=${quality} with scale=${scale.toFixed(2)}`);
                result = await compressImage(img, quality, scale);
                sizeCheck = (await checkFileSize(result, maxFileSize)).isValid;

                if (sizeCheck) {
                    Logger.debug("images", "Successfully processed with quality and scale adjustments");
                    return result;
                }

                // If file size still too big, try additional scaling at this quality level
                let additionalScale = scale * 0.9;
                for (let i = 0; i < 3; i++) {
                    Logger.debug("images", `Trying additional scaling: quality=${quality}, scale=${additionalScale.toFixed(2)}`);
                    result = await compressImage(img, quality, additionalScale);
                    sizeCheck = (await checkFileSize(result, maxFileSize)).isValid;

                    if (sizeCheck) {
                        Logger.debug("images", "Successfully processed with additional scaling");
                        return result;
                    }

                    additionalScale *= 0.7; // More aggressive scaling reduction
                }
            }

            // Last resort: try extreme compression and scaling
            result = await compressImage(img, 0.5, scale * 0.5);
            sizeCheck = (await checkFileSize(result, maxFileSize)).isValid;
            if (sizeCheck) {
                Logger.debug("images", "Successfully compressed with extreme settings");
                return result;
            }
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
