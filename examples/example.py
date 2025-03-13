import base64
import uuid
from dataclasses import dataclass
from io import BytesIO
from typing import Dict, List, Optional

import streamlit as st
from PIL import Image

from streamlit_chat_prompt import FileData, PromptReturn, prompt

st.title("streamlit-chat-prompt with Bedrock API Integration")


# Add Bedrock validation functions
def validate_bedrock_limits(
    files: List[FileData], text: Optional[str] = None
) -> Dict[str, bool]:
    """Validate files against Bedrock limits and return validation results."""
    results = {"valid": True, "messages": []}

    # Count documents and images
    documents = [f for f in files if not f.type.startswith("image/")]
    images = [f for f in files if f.type.startswith("image/")]

    # Check counts
    if len(documents) > 5:
        results["valid"] = False
        results["messages"].append(
            f"Exceeded Bedrock limit of 5 documents (found {len(documents)})"
        )

    if len(images) > 20:
        results["valid"] = False
        results["messages"].append(
            f"Exceeded Bedrock limit of 20 images (found {len(images)})"
        )

    # Check sizes
    for doc in documents:
        # Calculate approximate base64 decoded size
        size_bytes = len(doc.data) * 3 / 4  # Approximation of base64 to binary size
        size_mb = size_bytes / (1024 * 1024)
        if size_bytes > 4.5 * 1024 * 1024:  # 4.5MB
            results["valid"] = False
            results["messages"].append(
                f"Document {doc.name} size ({size_mb:.2f}MB) exceeds Bedrock limit of 4.5MB"
            )

    for img in images:
        size_bytes = len(img.data) * 3 / 4
        size_mb = size_bytes / (1024 * 1024)
        if size_bytes > 3.75 * 1024 * 1024:  # 3.75MB
            results["valid"] = False
            results["messages"].append(
                f"Image {getattr(img, 'name', 'unknown')} size ({size_mb:.2f}MB) exceeds Bedrock limit of 3.75MB"
            )

    # If no text is provided but documents are attached, validation fails
    if documents and not text:
        results["valid"] = False
        results["messages"].append("A text prompt is required when attaching documents")

    return results


def format_for_bedrock_converse(prompt_return: PromptReturn) -> Dict:
    """Format PromptReturn into Bedrock Converse API format."""
    # Build content blocks
    content_blocks = []

    # Text must come first
    if prompt_return.text:
        content_blocks.append({"text": prompt_return.text})

    # Add document blocks (non-image files)
    documents = (
        [f for f in prompt_return.files if not f.type.startswith("image/")]
        if prompt_return.files
        else []
    )
    for doc in documents:
        format_name = "pdf"
        if doc.type == "text/markdown" or (
            hasattr(doc, "name") and doc.name and doc.name.endswith(".md")
        ):
            format_name = "md"
        elif doc.type == "text/csv" or (
            hasattr(doc, "name") and doc.name and doc.name.endswith(".csv")
        ):
            format_name = "csv"
        # Add more mappings as needed

        content_blocks.append(
            {
                "document": {
                    "format": format_name,
                    "name": getattr(doc, "name", f"document.{format_name}"),
                    "source": {
                        "bytes": doc.data  # In real API usage, this would be binary not base64
                    },
                }
            }
        )

    # Add image blocks
    images = (
        [f for f in prompt_return.files if f.type.startswith("image/")]
        if prompt_return.files
        else []
    )
    for img in images:
        format_name = img.type.split("/")[1]
        content_blocks.append(
            {
                "image": {
                    "format": format_name,
                    "source": {
                        "bytes": img.data  # In real API usage, this would be binary not base64
                    },
                }
            }
        )

    # Create the message object
    message = {"role": "user", "content": content_blocks}

    return message


@dataclass
class ChatMessage:
    role: str
    content: str | PromptReturn


if "messages" not in st.session_state:
    messages: List[ChatMessage] = [
        ChatMessage(role="assistant", content="Hi there! What should we chat about?")
    ]
    st.session_state.messages = messages


@st.dialog("Prompt in dialog")
def dialog(default_input: str | PromptReturn | None = None, key="default_dialog_key"):
    dialog_input = prompt(
        "dialog_prompt",
        key=key,
        placeholder="This is a dialog prompt",
        main_bottom=False,
        default=default_input,
    )
    if dialog_input:
        st.write(dialog_input)


with st.sidebar:
    st.header("Sidebar")

    if st.button("Dialog Prompt", key="dialog_prompt_button"):
        dialog()

    if st.button(
        "Dialog Prompt with Default Value", key="dialog_prompt_with_default_button"
    ):
        # Read PDF file
        example_filename = "pdf-without-images.pdf"
        with open(f"../example_files/{example_filename}", "rb") as f:
            pdf_data = f.read()
            base64_pdf = base64.b64encode(pdf_data).decode("utf-8")
            dialog(
                default_input=PromptReturn(
                    text="This is a test message with a PDF",
                    files=[
                        FileData(
                            data=base64_pdf,
                            type="application/pdf",
                            format="base64",
                            name=example_filename,
                        )
                    ],
                ),
                key="dialog_with_default",
            )

for chat_message in st.session_state.messages:
    chat_message: ChatMessage

    with st.chat_message(chat_message.role):
        if isinstance(chat_message.content, PromptReturn):
            st.markdown(chat_message.content.text)
            if chat_message.content.files:  # Change from images to files
                for file_data in chat_message.content.files:
                    st.divider()
                    if file_data.type.startswith("image/"):
                        # Handle images as before
                        st.markdown("Using `st.markdown`")
                        st.markdown(
                            f"![Image example](data:{file_data.type};{file_data.format},{file_data.data})"
                        )

                        st.divider()
                        st.markdown("Using `st.image`")
                        image = Image.open(BytesIO(base64.b64decode(file_data.data)))
                        st.image(image)
                    elif file_data.type == "application/pdf":
                        st.markdown("PDF File:")
                        st.markdown(f"Filename: {file_data.name}")
                        pdf_bytes = BytesIO(base64.b64decode(file_data.data))
                        st.download_button(
                            label=f"Download {file_data.name}",
                            data=pdf_bytes,
                            file_name=file_data.name,
                            mime=file_data.type,
                            key=f"download_{file_data.type}_{uuid.uuid4()}",
                        )
                    elif file_data.type == "text/markdown":
                        st.markdown("Markdown File:")
                        st.markdown(f"Filename: {file_data.name}")
                        md_bytes = BytesIO(base64.b64decode(file_data.data))

                        # preview markdown content
                        with st.expander("Preview"):
                            md_content = md_bytes.getvalue().decode('utf-8')
                            st.markdown(md_content)

                        md_bytes.seek(0)  # Reset buffer position for download
                        st.download_button(
                            label=f"Download {file_data.name}",
                            data=md_bytes,
                            file_name=file_data.name,
                            mime=file_data.type,
                            key=f"download_{file_data.type}_{uuid.uuid4()}",
                        )
        else:
            st.markdown(chat_message.content)

# Show Bedrock validation status for submitted prompt
if "last_validation_result" not in st.session_state:
    st.session_state.last_validation_result = None

prompt_return: PromptReturn | None = prompt(
    name="foo",
    key="chat_prompt",
    placeholder="Hi there! What should we chat about?",
    main_bottom=True,
    log_level="debug",
    enable_clipboard_inspector=True,
)

if prompt_return:
    # Validate against Bedrock limits
    validation_result = validate_bedrock_limits(
        prompt_return.files or [], prompt_return.text
    )
    st.session_state.last_validation_result = validation_result

    if validation_result["valid"]:
        # Only add to conversation if valid
        st.session_state.messages.append(
            ChatMessage(role="user", content=prompt_return)
        )

        # Convert to Bedrock format (just for demonstration)
        bedrock_format = format_for_bedrock_converse(prompt_return)

        # In a real application, you'd send this to the Bedrock API
        # For this demo, we'll just echo back the text
        st.session_state.messages.append(
            ChatMessage(role="assistant", content=f"Echo:\n\n{prompt_return.text}")
        )

        # Optional: Show the Bedrock API format that would have been sent
        with st.expander("Bedrock API Format (Demo)"):
            st.json(bedrock_format)

        st.rerun()
    else:
        # Show validation errors
        for message in validation_result["messages"]:
            st.error(message)

# Display validation status if available
if (
    st.session_state.last_validation_result
    and not st.session_state.last_validation_result["valid"]
):
    with st.sidebar:
        st.error("Last submission had validation errors:")
        for msg in st.session_state.last_validation_result["messages"]:
            st.write(f"- {msg}")
