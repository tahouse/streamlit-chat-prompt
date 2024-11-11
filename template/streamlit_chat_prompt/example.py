import base64
import io

import streamlit as st
import streamlit.components.v1 as components
from PIL import Image
from prompt import prompt

# # Example usage
# styl = f"""
# <style>
#     .root  {{
#       position: fixed;
#       bottom: 3rem;
#     }}
# </style>
# """

with st.sidebar:
    st.markdown("test")
message = prompt(name="foo", key="better_chat_prompt", placeholder="Hi there!")
# message2 = prompt(name="foo", key="another", placeholder="Hi !")

st.write("Message:", message)
if message:
    message.message
    message.images
# if images:
#     for img in images:
#         st.image(img)

# st.chat_input("Enter your message")
