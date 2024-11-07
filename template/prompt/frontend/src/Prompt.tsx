// MyComponent.tsx
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
} from "@mui/material"
import { AttachFile, Send } from "@mui/icons-material"
import CloseIcon from "@mui/icons-material/Close"

interface State {
  message: string
  images: File[]
  isFocused: boolean
}

class ChatInput extends StreamlitComponentBase<State> {
  private fileInputRef: React.RefObject<HTMLInputElement>
  private handlePasteEvent: (e: ClipboardEvent) => void

  constructor(props: any) {
    super(props)
    this.fileInputRef = React.createRef<HTMLInputElement>()
    this.state = {
      message: "",
      images: [],
      isFocused: false,
    }

    // Bind methods to this
    this.handleSubmit = this.handleSubmit.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleFileUpload = this.handleFileUpload.bind(this)
    this.removeImage = this.removeImage.bind(this)

    // Initialize handlePasteEvent
    this.handlePasteEvent = (e: ClipboardEvent) => {
      e.preventDefault()

      const clipboardData = e.clipboardData
      if (!clipboardData) return

      // Handle files from clipboard
      const files = clipboardData.files
      if (files.length > 0) {
        const filesArray = Array.from(files)
        this.setState((prevState) => ({
          images: [...prevState.images, ...filesArray],
        }))
        return
      }

      // Handle images from clipboard
      const items = Array.from(clipboardData.items || [])
      items.forEach((item) => {
        if (item.type.indexOf("image") !== -1) {
          const blob = item.getAsFile()
          if (blob) {
            this.setState((prevState) => ({
              images: [...prevState.images, blob],
            }))
          }
        }
      })

      // Handle text separately if needed
      const text = clipboardData.getData("text")
      if (text) {
        const activeElement = document.activeElement
        if (activeElement?.tagName === "TEXTAREA") {
          return
        }
      }
    }
  }

  componentDidMount() {
    document.addEventListener("paste", this.handlePasteEvent)
  }

  componentWillUnmount() {
    document.removeEventListener("paste", this.handlePasteEvent)
  }

  handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      this.setState({
        images: [...this.state.images, ...Array.from(e.target.files)],
      })
    }
  }

  handleSubmit() {
    if (!this.state.message && this.state.images.length === 0) return

    const imagePromises = this.state.images.map((image) => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(image)
      })
    })

    Promise.all(imagePromises).then((imageData) => {
      Streamlit.setComponentValue({
        message: this.state.message,
        images: imageData,
      })
      this.setState({
        message: "",
        images: [],
      })
    })
  }

  validateFile(file: File): boolean {
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    return validTypes.includes(file.type)
  }

  removeImage(index: number) {
    this.setState({
      images: this.state.images.filter((_, i) => i !== index),
    })
  }

  handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      this.handleSubmit()
    }
  }

  render() {
    const { theme } = this.props

    return (
      <Paper
        elevation={3}
        // component="div"
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          maxHeight: "400px",
          backgroundColor: theme?.backgroundColor,
          color: theme?.textColor,
          fontFamily: theme?.font,
          p: 1, // Reduced padding on the outer container
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
                  sx={{
                    position: "absolute",
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
            minHeight: "20px", // Set a smaller initial height
            maxHeight: "300px",
            // overflow: "hidden",
            position: "relative", // Need this for absolute positioning
            p: 1.5, // Consistent padding all around
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
              // overflow: "auto",
              mr: "50px", // Make space for buttons
            }}
          >
            <TextField
              multiline
              maxRows={11}
              fullWidth
              value={this.state.message}
              onChange={(e) => this.setState({ message: e.target.value })}
              onKeyDown={this.handleKeyDown}
              placeholder={this.props.args["placeholder"]}
              variant="standard"
              sx={{
                overflowY: "auto", // Move the scroll to the TextField itself
                maxHeight: "calc(11 * 1.5em)", // maxRows * lineHeight
                "& .MuiInput-root": {
                  margin: 0,
                  color: theme?.textColor,
                  "&:before, &:after": {
                    display: "none",
                  },
                },
                "& .MuiInput-input": {
                  color: theme?.textColor,
                  "&::placeholder": {
                    color: `${theme?.textColor}99`,
                    opacity: 1,
                  },
                  padding: 0, // Remove padding from input
                  lineHeight: "1.5",
                  minHeight: "24px", // Matches single line height
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
              bottom: "8px", // Center vertically
              transform: "translateY(-50%)", // Perfect vertical centering
              backgroundColor: theme?.secondaryBackgroundColor,
            }}
          >
            <IconButton
              size="small"
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
    )
  }
}

export default withStreamlitConnection(ChatInput)
