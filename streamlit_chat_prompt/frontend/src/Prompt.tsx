import React from "react"
import {
  Streamlit,
  StreamlitComponentBase,
  withStreamlitConnection,
} from "streamlit-component-lib"
import {
  Box,
  TextField,
  IconButton,
  Paper,
  ImageList,
  ImageListItem,
  Snackbar,
  Alert,
} from "@mui/material"
import { AttachFile, Send } from "@mui/icons-material"
import CloseIcon from "@mui/icons-material/Close"

interface State {
  uuid: string
  text: string
  images: File[]
  isFocused: boolean
  disabled: boolean
  notification: {
    open: boolean
    message: string
    severity: "error" | "warning" | "info"
  }
}
class ChatInput extends StreamlitComponentBase<State> {
  private fileInputRef: React.RefObject<HTMLInputElement>
  private textFieldRef: React.RefObject<HTMLInputElement>
  private handlePasteEvent: (e: ClipboardEvent) => void
  private maxImageSize: number

  constructor(props: any) {
    super(props)
    this.maxImageSize = this.props.args?.max_image_size || 1024 * 1024 * 5
    this.state = {
      uuid: "",
      text: this.props.args?.default?.text || "",
      images: [],
      isFocused: false,
      disabled: this.props.args?.disabled || false,
      notification: {
        open: false,
        message: "",
        severity: "info",
      },
    }

    // Initialize state with default values if provided
    const defaultValue = this.props.args["default"] || {
      text: "",
      images: [],
    }

    // Handle default images if present
    if (defaultValue.images && defaultValue.images.length > 0) {
      // Convert base64 strings to Files
      Promise.all(
        defaultValue.images.map(async (dataUrl: string) => {
          const response = await fetch(dataUrl)
          const blob = await response.blob()
          const fileName = `default-image-${Math.random()
            .toString(36)
            .slice(2)}.${blob.type.split("/")[1]}`
          return new File([blob], fileName, { type: blob.type })
        })
      ).then((files) => {
        Promise.all(files.map((file) => this.processAndAddImage(file)))
      })
    }

    this.fileInputRef = React.createRef<HTMLInputElement>()
    this.textFieldRef = React.createRef<HTMLInputElement>()

    // Bind methods
    this.handleSubmit = this.handleSubmit.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleFileUpload = this.handleFileUpload.bind(this)
    this.removeImage = this.removeImage.bind(this)

    // Handle paste events
    this.handlePasteEvent = async (e: ClipboardEvent) => {
      if (this.state.disabled) return

      const clipboardData = e.clipboardData
      if (!clipboardData) return

      // Handle files and images from clipboard
      const files = clipboardData.files
      if (files.length > 0) {
        e.preventDefault()
        const filesArray = Array.from(files)
        for (const file of filesArray) {
          await this.processAndAddImage(file)
        }
        return
      }

      // Handle images from clipboard items
      const items = Array.from(clipboardData.items || [])
      for (const item of items) {
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault()
          const blob = item.getAsFile()
          if (blob) {
            await this.processAndAddImage(blob)
          }
        }
      }
    }
  }

  componentDidMount() {
    document.addEventListener("paste", this.handlePasteEvent)
    Streamlit.setFrameHeight()
    setTimeout(() => Streamlit.setFrameHeight(), 100)
  }

  componentWillUnmount() {
    document.removeEventListener("paste", this.handlePasteEvent)
  }

  // Helper method to focus text field
  private focusTextField = () => {
    if (this.textFieldRef.current) {
      this.textFieldRef.current.focus()
    }
  }

  private async processAndAddImage(file: File) {
    if (!file.type.startsWith("image/")) {
      console.log(`Skipping non-image file: ${file.name}`)
      this.showNotification("Only image files are supported", "error")
      return
    }

    try {
      console.log(`Processing file: ${file.name}`)
      const processedImage = await this.processImage(file)
      if (processedImage) {
        const sizeCheck = await this.checkFileSize(processedImage)
        if (sizeCheck.isValid) {
          console.log("Successfully processed image:", {
            name: file.name,
            originalSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
            finalFileSize: `${(sizeCheck.fileSize / 1024 / 1024).toFixed(2)}MB`,
            finalBase64Size: `${(sizeCheck.base64Size / 1024 / 1024).toFixed(
              2
            )}MB`,
          })
          this.setState((prevState) => ({
            images: [...prevState.images, processedImage],
          }))
        } else {
          throw new Error("Processed image still exceeds size limits")
        }
      } else {
        console.log(`Failed to process image: ${file.name}`)
        this.showNotification(
          `Could not compress "${file.name}" to under ${(
            this.maxImageSize /
            1024 /
            1024
          ).toFixed(1)} MB. Try a smaller image.`,
          "warning"
        )
      }
    } catch (err: unknown) {
      console.error(`Error processing file ${file.name}:`, err)
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred"
      this.showNotification(
        `Error processing "${file.name}": ${errorMessage}`,
        "error"
      )
    }
  }

  async handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return

    const files = Array.from(e.target.files)
    console.log(
      "Files selected:",
      files.map((f) => ({
        name: f.name,
        type: f.type,
        size: `${(f.size / 1024 / 1024).toFixed(2)}MB`,
      }))
    )

    for (const file of files) {
      await this.processAndAddImage(file)
    }
    this.focusTextField()
  }

  private async checkFileSize(file: File): Promise<{
    isValid: boolean
    fileSize: number
    base64Size: number
  }> {
    // Get base64 size
    const base64Size = await new Promise<number>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        resolve(base64String.length)
      }
      reader.readAsDataURL(file)
    })

    const fileSize = file.size
    const isValid =
      base64Size <= this.maxImageSize && fileSize <= this.maxImageSize

    console.log("File size check:", {
      fileName: file.name,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      base64Size: `${(base64Size / 1024 / 1024).toFixed(2)}MB`,
      maxSize: `${(this.maxImageSize / 1024 / 1024).toFixed(2)}MB`,
      isValid,
    })

    return {
      isValid,
      fileSize,
      base64Size,
    }
  }
  async processImage(file: File): Promise<File | null> {
    console.log(`Processing image: ${file.name}`, {
      originalSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      type: file.type,
    })

    // Check if the original file is already small enough
    const initialSizeCheck = await this.checkFileSize(file)
    if (initialSizeCheck.isValid) {
      console.log("Image already under size limit, returning original")
      return file
    }

    const img = new Image()
    const imgUrl = URL.createObjectURL(file)

    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = imgUrl
      })

      console.log("Image loaded:", {
        originalDimensions: `${img.width}x${img.height}`,
      })

      // Try compression only first
      for (const quality of [1.0, 0.9, 0.8, 0.7]) {
        console.log(`Trying compression only with quality=${quality}`)
        const result = await this.compressImage(img, quality, 1.0)
        const sizeCheck = await this.checkFileSize(result)
        if (sizeCheck.isValid) {
          console.log("Successfully compressed without scaling")
          return result
        }
      }

      // If compression alone didn't work, try scaling down
      let scale = 0.9
      for (let attempt = 0; attempt < 5; attempt++) {
        console.log(
          `Trying scaling with scale=${scale.toFixed(2)} and quality=0.8`
        )
        const result = await this.compressImage(img, 0.8, scale)
        const sizeCheck = await this.checkFileSize(result)
        if (sizeCheck.isValid) {
          console.log("Successfully compressed with scaling")
          return result
        }
        scale *= 0.8
      }

      console.log(
        "Failed to compress image below size limit after all attempts"
      )
      return null
    } catch (err) {
      console.error("Error processing image:", err)
      throw err
    } finally {
      URL.revokeObjectURL(imgUrl)
    }
  }

  private async compressImage(
    img: HTMLImageElement,
    quality: number,
    scale: number
  ): Promise<File> {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!

    canvas.width = img.width * scale
    canvas.height = img.height * scale

    console.log("Compressing image:", {
      quality,
      scale,
      canvasDimensions: `${canvas.width}x${canvas.height}`,
    })

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (blob) => {
          console.log("Blob created:", {
            size: `${(blob!.size / 1024 / 1024).toFixed(2)}MB`,
            type: "image/jpeg",
          })
          resolve(blob!)
        },
        "image/jpeg",
        quality
      )
    })

    const result = new File([blob], "compressed.jpg", { type: "image/jpeg" })
    console.log("Compression complete:", {
      inputDimensions: `${img.width}x${img.height}`,
      outputDimensions: `${canvas.width}x${canvas.height}`,
      quality,
      scale,
      finalSize: `${(result.size / 1024 / 1024).toFixed(2)}MB`,
    })

    return result
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
    })
  }

  handleSubmit() {
    if (this.state.disabled) return

    if (!this.state.text && this.state.images.length === 0) return

    const imagePromises = this.state.images.map((image) => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(image)
      })
    })

    Promise.all(imagePromises).then((imageData) => {
      Streamlit.setComponentValue({
        uuid: crypto.randomUUID(),
        text: this.state.text,
        images: imageData,
      })
      this.setState({
        uuid: "",
        text: "",
        images: [],
      })
    })
    this.focusTextField()
  }

  validateFile(file: File): boolean {
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    return validTypes.includes(file.type)
  }

  removeImage(index: number) {
    this.setState({
      images: this.state.images.filter((_, i) => i !== index),
    })
    this.focusTextField()
  }

  handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (this.state.disabled) return
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      this.handleSubmit()
    }
  }

  render() {
    const { theme } = this.props
    const disabled = this.state.disabled || false

    return (
      <>
        <Paper
          elevation={3}
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
            "& *": {
              // Apply to all children
              cursor: disabled ? "not-allowed" : "inherit",
            },
          }}
        >
          {this.state.images.length > 0 && (
            <ImageList sx={{ maxHeight: 100, m: 0 }} cols={4} rowHeight={80}>
              {this.state.images.map((image, index) => (
                <ImageListItem key={index} sx={{ position: "relative" }}>
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`Upload ${index}`}
                    loading="lazy"
                    style={{ objectFit: "cover", height: "80px" }}
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
              ))}
            </ImageList>
          )}

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              backgroundColor: theme?.secondaryBackgroundColor,
              borderRadius: 2,
              minHeight: "20px",
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
                value={this.state.text}
                onChange={(e) => this.setState({ text: e.target.value })}
                onKeyDown={this.handleKeyDown}
                placeholder={this.props.args["placeholder"]}
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
                onClick={this.handleSubmit}
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
      </>
    )
  }
}

export default withStreamlitConnection(ChatInput)
