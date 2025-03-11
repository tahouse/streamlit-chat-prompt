import base64
from dataclasses import dataclass
from io import BytesIO
from typing import List

import streamlit as st
from PIL import Image

from streamlit_chat_prompt import FileData, PromptReturn, prompt

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

    if st.button("Dialog Prompt", key=f"dialog_prompt_button"):
        dialog()

    if st.button(
        "Dialog Prompt with Default Value", key=f"dialog_prompt_with_default_button"
    ):
        # Read PDF file instead of image
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
                        # Handle PDFs
                        st.markdown("PDF File:")
                        st.markdown(f"Filename: {file_data.name}")
                        pdf_bytes = BytesIO(base64.b64decode(file_data.data))
                        st.download_button(
                            label="Download PDF",
                            data=pdf_bytes,
                            file_name=file_data.name,
                            mime=file_data.type,
                        )
        else:
            st.markdown(chat_message.content)

prompt_return: PromptReturn | None = prompt(
    name="foo",
    key="chat_prompt",
    placeholder="Hi there! What should we chat about?",
    main_bottom=True,
    log_level="debug",
    enable_clipboard_inspector=True,
)

if prompt_return:
    st.session_state.messages.append(ChatMessage(role="user", content=prompt_return))
    st.session_state.messages.append(
        ChatMessage(role="assistant", content=f"Echo:\n\n{prompt_return.text}")
    )
    st.rerun()
