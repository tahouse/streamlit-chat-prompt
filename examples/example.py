import base64
import uuid
from dataclasses import dataclass
from io import BytesIO
from typing import List

import streamlit as st
from PIL import Image

from streamlit_chat_prompt import (
    DEFAULT_DOCUMENT_COUNT, DEFAULT_DOCUMENT_FILE_SIZE,
    DEFAULT_IMAGE_COUNT, DEFAULT_IMAGE_FILE_SIZE, DEFAULT_IMAGE_PIXEL_DIMENSION,
    FileData, PromptReturn, prompt
)

st.title("streamlit-chat-prompt")


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

    # Controls for file limits in an expandable section
    with st.expander("File Upload Limits", expanded=False):
        # Image limits - use the default values from the package
        st.markdown("#### Image Limits")
        max_image_file_size_mb = st.slider(
            "Max Image Size (MB)",
            1, 50,
            int(DEFAULT_IMAGE_FILE_SIZE / (1024 * 1024)),
            1
        )
        max_image_dimension = st.slider(
            "Max Image Dimension (pixels)",
            1000, 10000,
            DEFAULT_IMAGE_PIXEL_DIMENSION,
            500
        )
        max_image_count = st.slider(
            "Max Number of Images",
            1, 30,
            DEFAULT_IMAGE_COUNT
        )

        # Document limits - use the default values from the package
        st.markdown("#### Document Limits")
        max_document_file_size_mb = st.slider(
            "Max Document Size (MB)",
            1.0, 10.0,
            DEFAULT_DOCUMENT_FILE_SIZE / (1024 * 1024),
            0.5
        )
        max_document_count = st.slider(
            "Max Number of Documents",
            1, 10,
            DEFAULT_DOCUMENT_COUNT
        )

        # Convert MB to bytes for the component
        max_image_file_size = max_image_file_size_mb * 1024 * 1024
        max_document_file_size = max_document_file_size_mb * 1024 * 1024

    # Use the package defaults when expander has not been opened
    if 'max_image_file_size_mb' not in locals():
        max_image_file_size = DEFAULT_IMAGE_FILE_SIZE
        max_image_dimension = DEFAULT_IMAGE_PIXEL_DIMENSION
        max_image_count = DEFAULT_IMAGE_COUNT
        max_document_file_size = DEFAULT_DOCUMENT_FILE_SIZE
        max_document_count = DEFAULT_DOCUMENT_COUNT


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
                            md_content = md_bytes.getvalue().decode("utf-8")
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
    max_image_file_size=max_image_file_size,
    max_image_pixel_dimension=max_image_dimension,
    max_image_count=max_image_count,
    max_document_file_size=max_document_file_size,
    max_document_count=max_document_count,
)

if prompt_return:
    st.session_state.messages.append(ChatMessage(role="user", content=prompt_return))
    st.session_state.messages.append(
        ChatMessage(role="assistant", content=f"Echo:\n\n{prompt_return.text}")
    )
    st.rerun()
