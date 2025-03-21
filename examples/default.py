import base64
import time
from dataclasses import dataclass
from io import BytesIO
from typing import List

import streamlit as st
from PIL import Image

from streamlit_chat_prompt import PromptReturn, prompt

st.title("streamlit-chat-prompt")


@dataclass
class ChatMessage:
    role: str
    content: str | PromptReturn


if "default_chat_input" not in st.session_state:
    st.session_state.default_chat_input = None

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
        st.session_state.default_chat_input = dialog_input
        time.sleep(2)
        st.rerun()


with st.sidebar:
    st.header("Sidebar")

    if st.button("Placeholder Prompt", key=f"default_prompt_button"):
        st.session_state.default_chat_input = "Button 1"

    if st.button("Default Prompt", key=f"default_prompt_button_2"):
        st.session_state.default_chat_input = "Button 2"

    if st.button("Dialog Prompt", key=f"dialog_prompt_button"):
        dialog()

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
    # placeholder="Hi there! What should we chat about?",
    placeholder=st.session_state.default_chat_input or "foo",
    main_bottom=True,
    default=st.session_state.default_chat_input,
)

if prompt_return:
    st.session_state.messages.append(ChatMessage(role="user", content=prompt_return))
    st.session_state.messages.append(
        ChatMessage(role="assistant", content=f"Echo: {prompt_return.text}")
    )
    st.rerun()
