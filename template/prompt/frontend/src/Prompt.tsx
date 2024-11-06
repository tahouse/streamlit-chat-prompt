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
    this.handleKeyPress = this.handleKeyPress.bind(this)
    this.handleFileUpload = this.handleFileUpload.bind(this)
    this.removeImage = this.removeImage.bind(this)
  }

  handleSubmit() {
    const reader = new FileReader()
    const imagePromises = this.state.images.map((image) => {
      return new Promise((resolve) => {
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

  handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      this.handleSubmit()
    }
  }

  handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      this.setState({
        images: [...this.state.images, ...Array.from(e.target.files)],
      })
    }
  }

  removeImage(index: number) {
    this.setState({
      images: this.state.images.filter((_, i) => i !== index),
    })
  }

  render() {
    const { theme } = this.props

    return (
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
                    right: 2,
                    top: 2,
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
            alignItems: "center", // Center items vertically
            gap: 1,
            backgroundColor: theme?.secondaryBackgroundColor,
            borderRadius: 1,
            py: 0.5, // Reduced vertical padding
            px: 1.5, // Keep some horizontal padding
            minHeight: "40px", // Set a consistent height
          }}
        >
          <Box sx={{ flex: 1, display: "flex", alignItems: "center" }}>
            <TextField
              multiline
              maxRows={20}
              fullWidth
              value={this.state.message}
              onChange={(e) => this.setState({ message: e.target.value })}
              onKeyPress={this.handleKeyPress}
              placeholder="What can I help with?"
              variant="standard"
              sx={{
                margin: 0,
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
                  padding: "4px 0", // Reduced padding
                },
              }}
            />
          </Box>

          <input
            type="file"
            multiple
            accept="image/*"
            hidden
            ref={this.fileInputRef}
            onChange={this.handleFileUpload}
          />

          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            <IconButton
              size="small" // Made buttons smaller
              onClick={() => this.fileInputRef.current?.click()}
              sx={{
                color: theme?.textColor,
                padding: "4px", // Reduced padding
                "&:hover": {
                  color: theme?.primaryColor,
                },
              }}
            >
              <AttachFile fontSize="small" /> {/* Made icon smaller */}
            </IconButton>

            <IconButton
              size="small" // Made buttons smaller
              onClick={this.handleSubmit}
              sx={{
                color: theme?.textColor,
                padding: "4px", // Reduced padding
                "&:hover": {
                  color: theme?.primaryColor,
                },
              }}
            >
              <Send fontSize="small" /> {/* Made icon smaller */}
            </IconButton>
          </Box>
        </Box>
      </Paper>
    )
  }
}

export default withStreamlitConnection(ChatInput)
