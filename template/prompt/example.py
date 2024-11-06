import streamlit as st
import streamlit.components.v1 as components
import base64
from PIL import Image
import io
from prompt import prompt


# Example usage
styl = f"""
<style>
    .root  {{
      position: fixed;
      bottom: 3rem;
    }}
</style>
"""
message = prompt(name="foo", key="bar")
if message:
    st.write("Message:", message)
    # if images:
    #     for img in images:
    #         st.image(img)

# st.chat_input("Enter your message")
