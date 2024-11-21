import base64
from io import BytesIO
import time
from typing import Any, Dict, List
import streamlit as st
from streamlit_chat_prompt import PromptReturn, prompt, ImageData
from PIL import Image


st.title("streamlit-chat-prompt")

if "messages" not in st.session_state:
    messages: List[Dict[str, str | PromptReturn]] = [
        {"role": "assistant", "content": "Hi there! What should we chat about?"}
    ]
    st.session_state.messages = messages

if "new_default_input" not in st.session_state:
    st.session_state.new_default_input = None


@st.dialog("Prompt in dialog")
def test_dg(default_input: str | PromptReturn | None = None, key="default_dialog_key"):
    dialog_input = prompt(
        "dialog_prompt",
        key=key,
        placeholder="This is a dialog prompt",
        main_bottom=False,
        default=default_input,
    )
    if dialog_input:
        st.write(dialog_input)
        st.session_state.new_default_input = dialog_input
        time.sleep(2)
        st.rerun()


with st.sidebar:
    st.header("Sidebar")

    if st.button("Dialog Prompt", key=f"dialog_prompt_button"):
        test_dg()

    if st.button(
        "Dialog Prompt with Default Value", key=f"dialog_prompt_with_default_button"
    ):
        with open("example_images/vangogh.png", "rb") as f:
            image_data = f.read()
            image = Image.open(BytesIO(image_data))
            base64_image = base64.b64encode(image_data).decode("utf-8")
            test_dg(
                default_input=PromptReturn(
                    message="This is a test message with an image",
                    images=[
                        ImageData(data=base64_image, type="image/png", format="base64")
                    ],
                ),
                key="dialog_with_default",
            )

for message in st.session_state.messages:
    message: Dict[str, str | PromptReturn]
    role: str = message["role"]
    content: str | PromptReturn = message["content"]

    with st.chat_message(role):
        if isinstance(content, PromptReturn):
            st.markdown(content.message)
            if content.images:
                for image in content.images:
                    st.divider()
                    image_data: bytes = base64.b64decode(image.data)
                    st.markdown("Ussng `st.image`")
                    st.image(Image.open(BytesIO(image_data)))

                    # or use markdown
                    st.divider()
                    st.markdown("Using `st.markdown`")
                    st.markdown(f"![Hello World](data:image/png;base64, {image.data})")
        else:
            st.markdown(content)

prompt_return: PromptReturn | None = prompt(
    name="foo",
    key="chat_prompt",
    placeholder="Hi there! What should we chat about?",
    main_bottom=True,
    default=st.session_state.new_default_input,
)

if prompt_return:
    st.session_state.messages.append({"role": "user", "content": prompt_return})
    st.session_state.messages.append(
        {"role": "assistant", "content": f"Echo: {prompt_return.message}"}
    )
    st.rerun()
