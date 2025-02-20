import base64
from dataclasses import dataclass
from io import BytesIO
from typing import List

import streamlit as st
from PIL import Image

from streamlit_chat_prompt import ImageData, PromptReturn, prompt

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
        with open("../example_images/vangogh.png", "rb") as f:
            image_data = f.read()
            image = Image.open(BytesIO(image_data))
            base64_image = base64.b64encode(image_data).decode("utf-8")
            dialog(
                default_input=PromptReturn(
                    text="This is a test message with an image",
                    images=[
                        ImageData(data=base64_image, type="image/png", format="base64")
                    ],
                ),
                key="dialog_with_default",
            )

for chat_message in st.session_state.messages:
    chat_message: ChatMessage

    with st.chat_message(chat_message.role):
        if isinstance(chat_message.content, PromptReturn):
            st.markdown(chat_message.content.text)
            if chat_message.content.images:
                for image_data in chat_message.content.images:
                    st.divider()
                    st.markdown("Using `st.markdown`")
                    st.markdown(
                        f"![Image example](data:{image_data.type};{image_data.format},{image_data.data})"
                    )

                    # or use PIL
                    st.divider()
                    st.markdown("Using `st.image`")
                    image = Image.open(BytesIO(base64.b64decode(image_data.data)))
                    st.image(image)

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
