import base64
from io import BytesIO
import streamlit as st
from streamlit_chat_prompt import PromptReturn, prompt, ImageData
from PIL import Image

st.title("streamlit-chat-prompt")


@st.dialog("Prompt in dialog")
def test_dg(default_input: str | PromptReturn | None = None, key="default_dialog_key"):
    st.write(
        prompt(
            "dialog_rompt",
            key=key,
            placeholder="This is a dialog prompt",
            main_bottom=False,
            default=default_input,
        )
    )


st.chat_message("assistant").write("Hi there! What should we chat about?")

prompt_return: PromptReturn | None = prompt(
    name="foo",
    key="chat_prompt",
    placeholder="Hi there! What should we chat about?",
    main_bottom=True,
)

if prompt_return:
    with st.chat_message("user"):
        st.write(prompt_return.message)
        if prompt_return.images:
            for image in prompt_return.images:
                st.divider()
                image_data: bytes = base64.b64decode(image.data)
                st.markdown("Ussng `st.image`")
                st.image(Image.open(BytesIO(image_data)))

                # or use markdown
                st.divider()
                st.markdown("Using `st.markdown`")
                st.markdown(f"![Hello World](data:image/png;base64,{image.data})")


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
