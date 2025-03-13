import { AttachFile, Send } from "@mui/icons-material";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Box,
  IconButton,
  Paper,
  Snackbar,
  Typography
} from "@mui/material";
import {
  PictureAsPdf,
  Description
} from '@mui/icons-material';
import React from "react";
import {
  Streamlit,
  StreamlitComponentBase
} from "streamlit-component-lib";

import { processImage } from "../utils/images";
import { Logger } from "../utils/logger";
import { generateUUID } from "../utils/uuid";
import { ClipboardInspector, ClipboardInspectorData, ClipboardItem, DIALOG_HEIGHTS, inspectClipboard } from "./ClipboardInspector";
import { PromptData } from "./PromptData";
import { Props } from "./Props";
import { State } from "./State";
import { ChatTextField } from "./TextField";
import { SupportedFile, SUPPORTED_FILE_TYPES, getAcceptedFileString } from './Types';

export class ChatInput extends StreamlitComponentBase<State, Props> {
  private fileInputRef: React.RefObject<HTMLInputElement>;
  private textFieldRef: React.RefObject<HTMLInputElement>;
  private maxImageSize: number;
  private isShowingDialog: boolean = false;

  // set limits based on Bedrock Converse API
  // https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-call.html
  private readonly FILE_LIMITS = {
    IMAGE: {
      maxSize: 3.75 * 1024 * 1024,  // 3.75MB
      maxCount: 20
    },
    DOCUMENT: {
      maxSize: 4.5 * 1024 * 1024,   // 4.5MB
      maxCount: 5
    }
  };  

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
        files: true,
      },
    });
    Logger.info("component", "Logger configuration:", Logger.getConfiguration());
    this.maxImageSize = this.props.args?.max_image_size || 1024 * 1024 * 5;

    const defaultValue = PromptData.fromProps(props);
    this.state = {
      uuid: "",
      text: defaultValue.text,
      files: [],
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
        data: [],
        loading: false,
      }
    };

    Logger.debug("component", "Initial construction", this.props);

    // Handle default images if present
    this.setFilesFromDefault(defaultValue);

    this.fileInputRef = React.createRef<HTMLInputElement>();
    this.textFieldRef = React.createRef<HTMLInputElement>();

    // Bind methods
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleFileUpload = this.handleFileUpload.bind(this);
    this.handleTextChange = this.handleTextChange.bind(this);
    this.handlePasteEvent = this.handlePasteEvent.bind(this);
  }
  private async handlePasteEvent(e: ClipboardEvent) {
    if (this.state.disabled || this.state.clipboardInspector.open) return;
  
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;
  
    // Get unique content types (excluding duplicates)
    const uniqueTypes = new Set(Array.from(clipboardData.items).map(item => {
      if (item.type.startsWith('image/')) return 'image';
      if (item.type === 'text/plain') return 'text';
      if (item.type === 'text/html') return 'html';
      return item.type;
    }));
  
    // Check if clipboard inspector is enabled via props
    const clipboardInspectorEnabled = this.props.args?.clipboard_inspector_enabled ?? false;
  
    // If more than one type, or one type but its not image/plaintext, show the inspector
    if ((uniqueTypes.size > 1 ||
      (!uniqueTypes.has('image') && !uniqueTypes.has('text'))) &&
      clipboardInspectorEnabled) {
      e.preventDefault(); // Prevent default paste
      const clipboardInspectorData = inspectClipboard(e);
      this.isShowingDialog = true;
  
      this.setState({
        clipboardInspector: {
          open: true,
          data: clipboardInspectorData,
          loading: false
        },
        userHasInteracted: true
      }, () => {
        this.updateFrameHeight(DIALOG_HEIGHTS.CLIPBOARD_INSPECTOR);
      });
      return;
    }

    // Handle single type directly
    const type = Array.from(uniqueTypes)[0];

    if (type === 'image') {
      e.preventDefault();
      const files = Array.from(clipboardData.files);
      for (const file of files) {
        if (this.isDuplicateFile(file, this.state.files)) {
          this.showNotification(
            `File "${file.name}" is already attached`,
            "warning"
          );
          continue;
        }
        const processedFile = await this.processFile(file);
        if (processedFile) {
          this.setState(prevState => ({
            files: [...prevState.files, processedFile],
            userHasInteracted: true
          }));
        }
      }
  
      // Handle image items that might not be in files
      const imageItems = Array.from(clipboardData.items)
        .filter(item => item.type.startsWith('image/'));
  
      for (const item of imageItems) {
        const file = item.getAsFile();
        if (file) {
          const processedFile = await this.processFile(file);
          if (processedFile) {
            this.setState(prevState => ({
              files: [...prevState.files, processedFile],
              userHasInteracted: true
            }));
          }
        }
      }
    }
    // Let default paste handle text/html
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
  private isDuplicateFile(newFile: File, existingFiles: SupportedFile[]): boolean {
    return existingFiles.some(existing => 
      existing.file.name === newFile.name && 
      existing.file.size === newFile.size &&
      existing.type === (newFile.type.startsWith('image/') ? 'image' : 
                        newFile.type === 'application/pdf' ? 'pdf' : 
                        'markdown')
    );
  }
  private async processFile(file: File): Promise<SupportedFile | null> {
    try {
      const isImage = file.type.startsWith('image/');
      const isPDF = SUPPORTED_FILE_TYPES.PDF.includes(file.type) || 
                    file.name.toLowerCase().endsWith('.pdf');
      const isMarkdown = SUPPORTED_FILE_TYPES.MARKDOWN.includes(file.type) || 
                    file.name.toLowerCase().endsWith('.md');

      // Determine file type and limits
      const limits = isImage ? this.FILE_LIMITS.IMAGE : this.FILE_LIMITS.DOCUMENT;

      // Check file size
      if (file.size > limits.maxSize) {
        const sizeInMb = (limits.maxSize / (1024 * 1024)).toFixed(1);
        this.showNotification(
          `File "${file.name}" exceeds ${isImage ? 'image' : 'document'} size limit of ${sizeInMb}MB`,
          "error"
        );
        return null;
      }
      // Process based on file type
      if (isImage) {
        const processedImage = await this.processImageFile(file);
        if (processedImage) {
          return {
            file: processedImage,
            type: 'image',
            preview: URL.createObjectURL(processedImage),
            size: processedImage.size
          };
        }
      } else if (isPDF) {
        return {
          file,
          type: 'pdf',
          preview: undefined,
          size: file.size
        };
      } else if (isMarkdown) {
        const markdownFile = file.type.includes('markdown') ? file : 
          new File([file], file.name, { type: 'text/markdown' });
          
        const preview = await this.generateMarkdownPreview(file);
        
        return {
          file: markdownFile,
          type: 'markdown',
          preview,
          size: file.size
        };
      }

      this.showNotification(`Unsupported file type: ${file.type}`, "error");
      return null;
    } catch (error) {
      Logger.error("files", `Error processing file ${file.name}:`, error);
      this.showNotification(`Error processing file: ${file.name}`, "error");
      return null;
    }
  }
  
  private async processImageFile(file: File): Promise<File | null> {
    const img = new Image();
    const imgUrl = URL.createObjectURL(file);

    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgUrl;
      });

      // Check image dimensions
      if (img.width > 8000 || img.height > 8000) {
        this.showNotification(
          `Image dimensions exceed maximum of 8000px`,
          "error"
        );
        return null;
      }

      return file;
    } catch (error) {
      Logger.error("images", `Error processing image file:`, error);
      return null;
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
  }
  
  private async generateMarkdownPreview(file: File): Promise<string> {
    try {
      const text = await file.text();
      // Get first 100 characters or first 3 lines, whichever is shorter
      const lines = text.split('\n', 4);
      const preview = lines.slice(0, 3).join('\n');
      return preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
    } catch (error) {
      Logger.warn("files", `Could not generate markdown preview for ${file.name}:`, error);
      return '';
    }
  }
  
  private async setFilesFromDefault(defaultValue: PromptData) {
    if (defaultValue.files && defaultValue.files.length > 0) {
      const processedFiles: SupportedFile[] = [];

      for (const fileData of defaultValue.files) {
        try {
          const response = await fetch(fileData.url);
          const blob = await response.blob();
          const fileName = fileData.name || `default-file-${Math.random().toString(36).slice(2)}`;
          const file = new File([blob], fileName, { type: fileData.type });

          if (fileData.type.startsWith('image/')) {
            const processedImage = await processImage(file, this.maxImageSize);
            if (processedImage) {
              processedFiles.push({
                file: processedImage,
                type: 'image',
                preview: URL.createObjectURL(processedImage),
                size: processedImage.size
              });
            }
          } else if (SUPPORTED_FILE_TYPES.PDF.includes(fileData.type)) {
            processedFiles.push({
              file,
              type: 'pdf',
              size: file.size,
            });
          } else if (SUPPORTED_FILE_TYPES.MARKDOWN.includes(fileData.type)) {
            processedFiles.push({
              file,
              type: 'markdown',
              size: file.size,
            });
          }
        } catch (error) {
          Logger.warn("files", `Failed to process file: ${error}`);
        }
      }
  
      this.setState({
        files: processedFiles,
      }, () => {
        this.updateFrameHeight();
      });
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
  private updateFrameHeight = (() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastHeight: number = 0;

    return (height?: number) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        // If explicit height is provided, use it directly
        if (height) {
          if (height !== lastHeight) {
            lastHeight = height;
            Streamlit.setFrameHeight(height);
          }
          return;
        }

        // Calculate new height based on current state
        const element = document.querySelector('.main-content') as HTMLElement;
        if (!element) return;

        let newHeight: number;

        if (this.state.clipboardInspector.open) {
          // When dialog is open, use fixed dialog height only
          newHeight = DIALOG_HEIGHTS.CLIPBOARD_INSPECTOR;
        } else {
          // Calculate content height
          const textField = element.querySelector('.MuiBox-root') as HTMLElement;
          const imageList = element.querySelector('.MuiImageList-root') as HTMLElement;

          let contentHeight = 0;

          // Add text field height (with max)
          if (textField) {
            contentHeight = Math.min(
              textField.scrollHeight,
              300 // max height for text field
            );
          }

          // Add image list height if present
          if (imageList) {
            contentHeight += imageList.offsetHeight + 8; // 8px for margin
          }

          // Add base padding
          newHeight = contentHeight + DIALOG_HEIGHTS.BASE_PADDING;
        }

        if (newHeight !== lastHeight) {
          lastHeight = newHeight;
          Streamlit.setFrameHeight(newHeight);
        }
      }, 100);
    };
  })();

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
      this.updateFrameHeight();
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
    if (!this.isShowingDialog && (this.state.files.length > 0 || this.state.text)) {
      this.updateFrameHeight();
    }
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
      !this.state.userHasInteracted &&
      !isRecentSubmission &&
      this.state.text === "" &&
      this.state.files.length === 0;  // Changed from images to files

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

      // Handle file defaults if present
      if (newDefault.files?.length > 0) {  // Changed from images to files
        this.setFilesFromDefault(newDefault);
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
      if (this.isDuplicateFile(file, this.state.files)) {
        this.showNotification(
          `File "${file.name}" is already attached`,
          "warning"
        );
        continue;
      }
      const processedFile = await this.processFile(file);
      if (processedFile) {
        this.setState(prevState => ({
          files: [...prevState.files, processedFile],
          userHasInteracted: true
        }));
      }
    }

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
  // In ChatInput.tsx, add a method to handle dialog close
  private handleCloseDialog = () => {
    this.isShowingDialog = false;
    this.setState({
      clipboardInspector: {
        open: false,
        data: [],
        loading: false
      }
    }, () => {
      setTimeout(() => this.updateFrameHeight(), 100); // Changed from Streamlit.setFrameHeight()
    });
  };

  private handleClipboardSelection = (selectedItems: ClipboardItem[]) => {
    selectedItems.forEach(async item => {
      if (item.type.startsWith('image/') && item.as_file) {
        if (this.isDuplicateFile(item.as_file, this.state.files)) {
          this.showNotification(
            `File "${item.as_file.name}" is already attached`,
            "warning"
          );
          return;
        }
        const processedFile = await this.processFile(item.as_file);
        if (processedFile) {
          this.setState(prevState => ({
            files: [...prevState.files, processedFile],
            userHasInteracted: true
          }));
        }
      } else if (item.content) {
        let textContent = item.content.toString();

        // Handle extracted images if present
        if (item.extractedImages?.length) {
          // Process all selected images
          for (const img of item.extractedImages) {
            const processedFile = await this.processFile(img.file);
            if (processedFile) {
              this.setState(prevState => ({
                files: [...prevState.files, processedFile],
                userHasInteracted: true
              }));
            }
          }

          // If content is markdown, replace placeholders with markdown image syntax
          if (item.convertToMarkdown) {
            item.extractedImages.forEach((img, idx) => {
              const placeholder = `[embedded-image-${idx}]`;
              const markdownImage = `![image-${idx}][${idx}]`;
              textContent = textContent.replace(placeholder, markdownImage);
            });
  
            // Add image references at the end
            textContent += '\n\n';
            item.extractedImages.forEach((_, idx) => {
              textContent += `[${idx}]: attachment:${idx}\n`;
            });
          }
        }
  
        this.setState(prev => ({
          text: prev.text + (prev.text ? '\n' : '') + textContent,
          userHasInteracted: true
        }));
      }
    });
  }; 

  async handleSubmit() {
    if (this.state.disabled) return;
    if (!this.state.text && this.state.files.length === 0) return;
  
    // Validate files for Bedrock requirements
    const hasDocs = this.state.files.some(f => f.type !== 'image');
    if (hasDocs && !this.state.text.trim()) {
      this.showNotification(
        "A text prompt is required when attaching documents",
        "warning"
      );
      return;
    }
  
    const filePromises = this.state.files.map(async (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataString = reader.result as string;
          const data = dataString.split(',')[1];
  
          resolve({
            type: file.file.type,
            format: 'base64',
            data: data,
            name: file.file.name,
            file_type: file.type
          });
        };
        reader.readAsDataURL(file.file);
      });
    });

    const fileData = await Promise.all(filePromises);

    const submission = {
      uuid: generateUUID(),
      text: this.state.text,
      files: fileData,
    };
  
    Streamlit.setComponentValue(submission);
    this.setState({
      uuid: "",
      text: "",
      files: [],
      userHasInteracted: false,
      lastSubmissionTime: Date.now(),
    });
  
    this.focusTextField();
  }

  removeFile(index: number) {
    this.setState(prevState => {
      const newFiles = [...prevState.files];
      const removedFile = newFiles[index];
      if (removedFile.preview) {
        URL.revokeObjectURL(removedFile.preview);
      }
      newFiles.splice(index, 1);
      return { files: newFiles };
    });
    this.focusTextField();
  }

  async handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (this.state.disabled || this.state.clipboardInspector.open) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await this.handleSubmit();
    }
  }

  private renderFilePreview(file: SupportedFile, index: number) {
    const { theme } = this.props;

    switch (file.type) {
      case 'image':
        return file.preview && (
          <img
            src={file.preview}
            alt={`Upload ${index}`}
            style={{ height: '80px', width: 'auto', objectFit: 'cover' }}
          />
        );

      case 'pdf':
        return (
          <Box sx={{ p: 1, display: 'flex', alignItems: 'center' }}>
            <PictureAsPdf sx={{ color: theme?.textColor }} />
            <Typography sx={{ ml: 1, color: theme?.textColor }}>
              {file.file.name}
            </Typography>
          </Box>
        );

      case 'markdown':
        return (
          <Box 
            sx={{ 
              p: 1, 
              display: 'flex', 
              flexDirection: 'column',
              minWidth: '200px',
              maxWidth: '300px'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Description sx={{ color: theme?.textColor }} />
              <Typography 
                sx={{ 
                  ml: 1, 
                  color: theme?.textColor,
                  fontWeight: 'medium'
                }}
              >
                {file.file.name}
              </Typography>
            </Box>
            {file.preview && (
              <Typography
                sx={{
                  color: theme?.textColor,
                  fontSize: '0.75rem',
                  opacity: 0.8,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  overflow: 'hidden',
                  maxHeight: '60px',
                  backgroundColor: `${theme?.secondaryBackgroundColor}66`,
                  p: 0.5,
                  borderRadius: 1,
                }}
              >
                {file.preview}
              </Typography>
            )}
          </Box>
        );

      default:
        return (
          <Typography sx={{ p: 1, color: theme?.textColor }}>
            {file.file.name}
          </Typography>
        );
    }
  }

  render() {
    const { theme } = this.props;
    const disabled = this.state.disabled || false;
    this.maxImageSize = this.props.args?.max_image_size || 1024 * 1024 * 5;
    Logger.debug("events", "Prompt render", this.props.args, this.state);

    return (
      <Box className="main-content"
        sx={{
          position: 'relative',
          height: this.state.clipboardInspector.open ?
            `${DIALOG_HEIGHTS.CLIPBOARD_INSPECTOR + 32}px` : // Add 32px (16px top + 16px bottom) for margins
            'auto',
        }}>
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
            p: this.state.clipboardInspector.open ? 1 : 0,
            transition: "opacity 0.2s ease",
            cursor: disabled ? "not-allowed" : "default",
            "& *": {
              cursor: disabled ? "not-allowed" : "inherit",
            },
            opacity: this.state.clipboardInspector.open ? 0 : 1,
            visibility: this.state.clipboardInspector.open ? 'hidden' : 'visible',
          }}
        >
          {this.state.files.length > 0 && (
            <Box sx={{ maxHeight: 100, m: 0, overflowX: 'auto', whiteSpace: 'nowrap' }}>
              {this.state.files.map((file, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'inline-flex',
                    position: 'relative',
                    m: 0.5,
                    borderRadius: 1,
                    border: `1px solid ${theme?.secondaryBackgroundColor}`,
                    backgroundColor: `${theme?.secondaryBackgroundColor}33`,
                  }}
                >
                  {this.renderFilePreview(file, index)}
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
                    onClick={() => this.removeFile(index)}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
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
              accept={getAcceptedFileString()}
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

        <ClipboardInspector
          open={this.state.clipboardInspector.open}
          data={this.state.clipboardInspector.data}
          theme={this.props.theme}
          onClose={this.handleCloseDialog}
          onSelect={this.handleClipboardSelection}
          setData={(value: React.SetStateAction<ClipboardInspectorData[]>) => {
            const newData = typeof value === 'function' ? value(this.state.clipboardInspector.data) : value;
            this.setState({
              clipboardInspector: {
                ...this.state.clipboardInspector,
                data: newData
              }
            });
          }}
        />
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
      </Box>
    );
  }
}