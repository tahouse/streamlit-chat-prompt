import { AttachFile, Send } from "@mui/icons-material";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Box,
  IconButton,
  ImageList,
  ImageListItem,
  Paper,
  Snackbar
} from "@mui/material";
import React from "react";
import {
  Streamlit,
  StreamlitComponentBase
} from "streamlit-component-lib";
import { checkFileSize, processImage } from "../utils/images";
import { Logger } from "../utils/logger";
import { generateUUID } from "../utils/uuid";
import { ClipboardInspector, inspectClipboard } from "./ClipboardInspector";
import { PromptData } from "./PromptData";
import { Props } from "./Props";
import { State } from "./State";
import { ChatTextField } from "./TextField";
export class ChatInput extends StreamlitComponentBase<State, Props> {
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
      clipboardInspector: {
        open: false,
        data: []
      }
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
      // Get the clipboard data and update state
      const clipboardInspectorData = inspectClipboard(e);
      this.setState({
        clipboardInspector: {
          open: true,
          data: clipboardInspectorData
        },
        userHasInteracted: true
      });
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      this.setState({ userHasInteracted: true });

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
          return new File([blob], fileName, { type: blob.type });
        })
      );

      // Process images and collect them
      const processedImages: File[] = [];
      for (const file of files) {
        const processedImage = await processImage(file, this.maxImageSize);
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

      const processedImage = await processImage(file, this.maxImageSize);
      if (processedImage) {
        const sizeCheck = await checkFileSize(processedImage, this.maxImageSize);
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
    this.setState({ userHasInteracted: true });

    this.focusTextField();
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
      uuid: generateUUID(),
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
    const { theme } = this.props;
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
            <ImageList sx={{ maxHeight: 100, m: 0 }} cols={4} rowHeight={80}>
              {this.state.images.map((image, index) => {
                const objectUrl = URL.createObjectURL(image);
                return (
                  <ImageListItem key={index} sx={{ position: "relative" }}>
                    <img
                      src={objectUrl}
                      alt={`Upload ${index}`}
                      loading="lazy"
                      style={{ objectFit: "cover", height: "80px" }}
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
              <ChatTextField
                value={this.state.text}
                onChange={this.handleTextChange}
                onKeyDown={this.handleKeyDown}
                disabled={this.state.disabled}
                placeholder={this.props.args?.placeholder ?? ''}
                inputRef={this.textFieldRef}
                theme={this.props.theme}
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
              notification: { ...this.state.notification, open: false },
            })
          }
        >
          <Alert
            onClose={() =>
              this.setState({
                notification: { ...this.state.notification, open: false },
              })
            }
            severity={this.state.notification.severity}
            sx={{ width: "100%" }}
          >
            {this.state.notification.message}
          </Alert>
        </Snackbar>

        <ClipboardInspector
          open={this.state.clipboardInspector.open}
          data={this.state.clipboardInspector.data}
          theme={this.props.theme}
          onClose={() => this.setState({
            clipboardInspector: { ...this.state.clipboardInspector, open: false }
          })}
        />
      </>
    );
  }
}