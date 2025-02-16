import {AttachFile, Send} from "@mui/icons-material";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Box,
  IconButton,
  ImageList,
  ImageListItem,
  Paper,
  Snackbar,
  TextField,
} from "@mui/material";
import React from "react";
import {
  Streamlit,
  StreamlitComponentBase,
  withStreamlitConnection,
} from "streamlit-component-lib";
import {Logger} from "./logger";

class PromptData {
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

interface Props {
  default?: {
    text?: string;
    images?: string[];
  };
  // force_apply_default?: boolean
  max_image_size?: number;
  placeholder?: string;
  disabled?: boolean;
  key?: string;
  debug?: boolean;
}

interface State {
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
}

class ChatInput extends StreamlitComponentBase<State, Props> {
  private fileInputRef: React.RefObject<HTMLInputElement>;
  private textFieldRef: React.RefObject<HTMLInputElement>;
  private handlePasteEvent: (e: ClipboardEvent) => void;
  private maxImageSize: number;

  constructor(props: Props) {
    super(props as any);

    // Configure logger based on props
    Logger.configure({
      enabled: true,
      level: (this.props.args?.debug?.toLowerCase() as | "error" | "warn" | "debug") || "warn",
      categories: {
        component: true,
        state: true,
        images: true,
        events: true,
      },
    });
    Logger.info("component", "Logger configuration:", Logger.getConfiguration());
    this.maxImageSize = this.props.args?.max_image_size || 1024 * 1024 * 5;

    const defaultValue = PromptData.fromProps(props);
    this.state = {
      uuid: "",
      text: defaultValue.text,
      images: [],
      isFocused: false,
      disabled: this.props.args?.disabled || false,
      userHasInteracted: false,
      lastSubmissionTime: 0,
      notification: {
        open: false,
        message: "",
        severity: "info",
      },
    };

    Logger.debug("component", "Initial construction", this.props);

    // Handle default images if present
    this.setImagesFromDefault(defaultValue);

    this.fileInputRef = React.createRef<HTMLInputElement>();
    this.textFieldRef = React.createRef<HTMLInputElement>();

    // Bind methods
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleFileUpload = this.handleFileUpload.bind(this);
    this.removeImage = this.removeImage.bind(this);
    this.handleTextChange = this.handleTextChange.bind(this);

    // Handle paste events
    this.handlePasteEvent = async (e: ClipboardEvent) => {
      if (this.state.disabled) return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      this.setState({userHasInteracted: true});

      // Handle files and images from clipboard
      const files = clipboardData.files;
      if (files.length > 0) {
        e.preventDefault();
        const filesArray = Array.from(files);
        for (const file of filesArray) {
          await this.processAndAddImage(file);
        }
        return;
      }

      // Handle images from clipboard items
      const items = Array.from(clipboardData.items || []);
      for (const item of items) {
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            await this.processAndAddImage(blob);
          }
        }
      }
    };
  }

  private isMobileDevice(): boolean {
    return (
      (typeof window !== "undefined" &&
        (navigator.userAgent.match(/Android/i) ||
          navigator.userAgent.match(/webOS/i) ||
          navigator.userAgent.match(/iPhone/i) ||
          navigator.userAgent.match(/iPad/i) ||
          navigator.userAgent.match(/iPod/i) ||
          navigator.userAgent.match(/BlackBerry/i) ||
          navigator.userAgent.match(/Windows Phone/i))) !== null
    );
  }
  private async setImagesFromDefault(defaultValue: PromptData) {
    if (defaultValue.images && defaultValue.images.length > 0) {
      // Convert base64 strings to Files
      const files = await Promise.all(
        defaultValue.images.map(async (dataUrl: string) => {
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const fileName = `default-image-${Math.random()
            .toString(36)
            .slice(2)}.${blob.type.split("/")[1]}`;
          return new File([blob], fileName, {type: blob.type});
        })
      );

      // Process images and collect them
      const processedImages: File[] = [];
      for (const file of files) {
        const processedImage = await this.processImage(file);
        if (processedImage) {
          processedImages.push(processedImage);
        } else {
          Logger.warn("images", "Failed to process image", file.name);
          this.showNotification(
            `Could not compress "${file.name}" to under ${(
              this.maxImageSize /
              1024 /
              1024
            ).toFixed(1)} MB. Try a smaller image.`,
            "warning"
          );
        }
      }

      // Replace the images in the state with the new processed images
      this.setState(
        {
          images: processedImages,
          userHasInteracted: true,
        },
        () => {
          // Force frame height update after state change
          setTimeout(() => Streamlit.setFrameHeight(), 0);
        }
      );
    }
  }
  // Define message handler as class method
  private handleMessage = (event: MessageEvent) => {
    Logger.debug("events", "Message received in handler:", {
      data: event.data,
      origin: event.origin,
      source: event.source,
      type: typeof event.data,
    });

    if (event.data.type === "focus_textarea") {
      Logger.debug("events", "Focus textarea event received");
      this.focusTextField();
    }
  };

  public componentDidMount(): void {
    super.componentDidMount();

    try {
      Logger.debug("events", "Component mounted, adding message listener");
    } catch (e) {
      console.error("ChatInput: Error using Logger in componentDidMount:", e);
    }

    try {
      window.addEventListener("message", this.handleMessage);
      document.addEventListener("paste", this.handlePasteEvent);
      Streamlit.setFrameHeight();
    } catch (e) {
      console.error("ChatInput: Error in componentDidMount:", e);
    }
  }

  public componentWillUnmount() {
    window.removeEventListener("message", this.handleMessage);
    document.removeEventListener("paste", this.handlePasteEvent);
  }

  public componentDidUpdate() {
    super.componentDidUpdate();

    // Get current default values
    const newDefault = PromptData.fromProps(this.props);

    // Don't apply defaults if we've just submitted (give Python time to update props)
    const timeSinceSubmission = Date.now() - this.state.lastSubmissionTime;
    const isRecentSubmission = timeSinceSubmission < 1000; // 1 second threshold

    Logger.debug("state", "Component update", {
      newDefault,
      currentState: this.state,
      shouldApplyDefault:
        !this.state.userHasInteracted && this.state.text === "",
    });

    // Determine when to apply defaults
    const shouldApplyDefault =
      // forceApplyDefault ||
      !this.state.userHasInteracted &&
      !isRecentSubmission &&
      this.state.text === "" &&
      this.state.images.length === 0;

    if (shouldApplyDefault) {
      Logger.debug("events", "Applying default", {
        newDefault,
        timeSinceSubmission,
        state: this.state,
      });
      this.setState({
        text: newDefault.text,
        userHasInteracted: false,
      });

      // Handle image defaults if needed
      if (newDefault.images?.length > 0) {
        this.setImagesFromDefault(newDefault);
      }
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Logger.error("component", "Error in ChatInput", error, errorInfo);
    this.setState({
      notification: {
        open: true,
        message: "An error occurred",
        severity: "error",
      },
    });
  }

  // Helper method to focus text field
  private focusTextField = () => {
    if (this.isMobileDevice()) {
      // Actively blur/remove focus on mobile
      if (this.textFieldRef.current) {
        this.textFieldRef.current.blur();
      }
      // Also try to remove focus from any active element
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    } else if (this.textFieldRef.current) {
      // Focus on desktop as before
      this.textFieldRef.current.focus();
    }
  };

  // Update user interaction tracking
  handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({
      text: e.target.value,
      userHasInteracted: true,
    });
  };

  private async processAndAddImage(file: File) {
    if (!file.type.startsWith("image/")) {
      Logger.debug("images", "Skipping non-image file", file.name);
      this.showNotification("Only image files are supported", "error");
      return;
    }

    try {
      Logger.debug("images", "Processing file", file.name);

      const processedImage = await this.processImage(file);
      if (processedImage) {
        const sizeCheck = await this.checkFileSize(processedImage);
        if (sizeCheck.isValid) {
          Logger.debug("images", "Successfully processed image:", {
            name: file.name,
            originalSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
            finalFileSize: `${(sizeCheck.fileSize / 1024 / 1024).toFixed(2)}MB`,
            finalBase64Size: `${(sizeCheck.base64Size / 1024 / 1024).toFixed(
              2
            )}MB`,
          });

          this.setState(
            (prevState) => ({
              images: [...prevState.images, processedImage],
              userHasInteracted: true,
            }),
            () => {
              // Force frame height update after state change
              setTimeout(() => Streamlit.setFrameHeight(), 0);
            }
          );
        } else {
          throw new Error("Processed image still exceeds size limits");
        }
      } else {
        Logger.warn("images", "Failed to process image", file.name);
        this.showNotification(
          `Could not compress "${file.name}" to under ${(
            this.maxImageSize /
            1024 /
            1024
          ).toFixed(1)} MB. Try a smaller image.`,
          "warning"
        );
      }
    } catch (err: unknown) {
      Logger.error("images", `Error processing file ${file.name}:`, err);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      this.showNotification(
        `Error processing "${file.name}": ${errorMessage}`,
        "error"
      );
    }
  }

  async handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;

    const files = Array.from(e.target.files);
    Logger.debug(
      "events",
      "Files selected:",
      files.map((f) => ({
        name: f.name,
        type: f.type,
        size: `${(f.size / 1024 / 1024).toFixed(2)}MB`,
      }))
    );

    for (const file of files) {
      await this.processAndAddImage(file);
    }
    this.setState({userHasInteracted: true});

    this.focusTextField();
  }

  private async checkFileSize(file: File): Promise<{
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
      base64Size <= this.maxImageSize && fileSize <= this.maxImageSize;

    Logger.debug("images", "File size check", {
      fileName: file.name,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      base64Size: `${(base64Size / 1024 / 1024).toFixed(2)}MB`,
      maxSize: `${(this.maxImageSize / 1024 / 1024).toFixed(2)}MB`,
      isValid,
    });

    return {
      isValid,
      fileSize,
      base64Size,
    };
  }

  async processImage(file: File): Promise<File | null> {
    Logger.debug("images", "Processing image", file.name, {
      originalSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      type: file.type,
    });

    // Check if the original file is already small enough
    const initialSizeCheck = await this.checkFileSize(file);
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
        const result = await this.compressImage(img, quality, 1.0);
        const sizeCheck = await this.checkFileSize(result);
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
        const result = await this.compressImage(img, 0.8, scale);
        const sizeCheck = await this.checkFileSize(result);
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

  private async compressImage(
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

    const result = new File([blob], "compressed.jpg", {type: "image/jpeg"});
    Logger.debug("images", "Compression complete:", {
      inputDimensions: `${img.width}x${img.height}`,
      outputDimensions: `${canvas.width}x${canvas.height}`,
      quality,
      scale,
      finalSize: `${(result.size / 1024 / 1024).toFixed(2)}MB`,
    });

    return result;
  }

  private showNotification(
    message: string,
    severity: "error" | "warning" | "info"
  ) {
    this.setState({
      notification: {
        open: true,
        message,
        severity,
      },
    });
  }

  private generateUUID = (): string => {
    console.log("Generating UUID");
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

  async handleSubmit() {
    Logger.group("events", "Submit");
    Logger.debug("events", "Current state", this.state);

    if (this.state.disabled) return;

    if (!this.state.text && this.state.images.length === 0) return;

    const imagePromises = this.state.images.map((image) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(image);
      });
    });

    // Wait for all images to be processed
    const imageData = await Promise.all(imagePromises);

    const submission = {
      uuid: this.generateUUID(),
      text: this.state.text,
      images: imageData,
    };
    Logger.debug("events", "Submission:", submission);

    Streamlit.setComponentValue(submission);
    this.setState({
      uuid: "",
      text: "",
      images: [],
      userHasInteracted: false,
      lastSubmissionTime: Date.now(), // Record submission time
    });
    this.focusTextField();
    Logger.debug("events", "Submission complete");
    Logger.groupEnd("events");
  }

  removeImage(index: number) {
    this.setState({
      images: this.state.images.filter((_, i) => i !== index),
    });
    this.focusTextField();
  }

  async handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (this.state.disabled) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await this.handleSubmit();
    }
  }

  render() {
    const {theme} = this.props;
    const disabled = this.state.disabled || false;
    this.maxImageSize = this.props.args?.max_image_size || 1024 * 1024 * 5;
    Logger.debug("events", "Prompt render", this.props.args, this.state);

    return (
      <>
        <Paper
          elevation={0}
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            maxHeight: "400px",
            backgroundColor: theme?.backgroundColor,
            color: theme?.textColor,
            fontFamily: theme?.font,
            p: 1,
            // opacity: disabled ? 0.6 : 1, // Use consistent opacity for disabled state
            transition: "opacity 0.2s ease", // Smooth transition when disabled state changes
            cursor: disabled ? "not-allowed" : "default",
            // "& > *": { width: "100%" }, // Ensure children take full width

            "& *": {
              // Apply to all children
              cursor: disabled ? "not-allowed" : "inherit",
            },
          }}
        >
          {this.state.images.length > 0 && (
            <ImageList sx={{maxHeight: 100, m: 0}} cols={4} rowHeight={80}>
              {this.state.images.map((image, index) => {
                const objectUrl = URL.createObjectURL(image);
                return (
                  <ImageListItem key={index} sx={{position: "relative"}}>
                    <img
                      src={objectUrl}
                      alt={`Upload ${index}`}
                      loading="lazy"
                      style={{objectFit: "cover", height: "80px"}}
                      onLoad={(e) => {
                        URL.revokeObjectURL(objectUrl);
                      }}
                    />
                    <IconButton
                      size="small"
                      disabled={disabled}
                      sx={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        padding: "4px",
                        backgroundColor: `${theme?.secondaryBackgroundColor}cc`,
                        color: theme?.textColor,
                        "&:hover": {
                          backgroundColor: `${theme?.primaryColor}33`,
                        },
                      }}
                      onClick={() => this.removeImage(index)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </ImageListItem>
                );
              })}
            </ImageList>
          )}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              backgroundColor: theme?.secondaryBackgroundColor,
              borderRadius: 2,
              minHeight: "60px",
              maxHeight: "300px",
              position: "relative",
              p: 1.5,
            }}
          >
            <input
              type="file"
              multiple
              accept="image/*"
              hidden
              ref={this.fileInputRef}
              onChange={this.handleFileUpload}
            />
            <Box
              sx={{
                flex: 1,
                display: "flex",
                mr: "50px",
              }}
            >
              <TextField
                multiline
                maxRows={11}
                fullWidth
                disabled={disabled}
                // value={displayText}
                // onChange={(e) => this.setState({ text: e.target.value })}
                value={this.state.text}
                onChange={this.handleTextChange}
                onKeyDown={this.handleKeyDown}
                placeholder={this.props.args?.placeholder}
                variant="standard"
                inputRef={this.textFieldRef}
                sx={{
                  overflowY: "auto",
                  maxHeight: "calc(11 * 1.5em)",
                  "& .MuiInput-root": {
                    margin: 0,
                    color: theme?.textColor,
                    "&:before, &:after": {
                      display: "none",
                    },
                    "&.Mui-disabled": {
                      // opacity: 0.7,
                      cursor: "not-allowed",
                    },
                  },
                  "& .MuiInput-input": {
                    color: theme?.textColor,
                    "&::placeholder": {
                      color: `${theme?.textColor}99`,
                      // opacity: disabled ? 0.5 : 1,
                    },
                    padding: 0,
                    lineHeight: "1.5",
                    minHeight: "24px",
                    "&.Mui-disabled": {
                      cursor: "not-allowed",
                    },
                  },
                }}
              />
            </Box>

            <Box
              sx={{
                display: "flex",
                gap: 0.5,
                alignItems: "center",
                position: "absolute",
                right: "12px",
                bottom: "8px",
                transform: "translateY(-50%)",
                backgroundColor: theme?.secondaryBackgroundColor,
              }}
            >
              <IconButton
                size="small"
                disabled={disabled}
                onClick={() => this.fileInputRef.current?.click()}
                sx={{
                  color: theme?.textColor,
                  padding: "0px",
                  "&:hover": {
                    color: theme?.primaryColor,
                  },
                }}
              >
                <AttachFile fontSize="small" />
              </IconButton>

              <IconButton
                size="small"
                disabled={disabled}
                onClick={async () => await this.handleSubmit()}
                sx={{
                  color: theme?.textColor,
                  padding: "0px",
                  "&:hover": {
                    color: theme?.primaryColor,
                  },
                }}
              >
                <Send fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Paper>
        <Snackbar
          open={this.state.notification.open}
          autoHideDuration={6000}
          onClose={() =>
            this.setState({
              notification: {...this.state.notification, open: false},
            })
          }
        >
          <Alert
            onClose={() =>
              this.setState({
                notification: {...this.state.notification, open: false},
              })
            }
            severity={this.state.notification.severity}
            sx={{width: "100%"}}
          >
            {this.state.notification.message}
          </Alert>
        </Snackbar>
      </>
    );
  }
}

export default withStreamlitConnection(ChatInput);
