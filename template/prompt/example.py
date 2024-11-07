import streamlit as st
import streamlit.components.v1 as components
import base64
from PIL import Image
import io
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
st.markdown(
    """
    <style>
    [data-testid="stCustomComponentV1"] {
        position: fixed;
        bottom: 1rem;
        z-index: 1000;
    }

    /* Main content area */
    section[data-testid="stMainContainer"] {
        padding-bottom: 100px;  /* Make room for the fixed component */
    }

    /* When sidebar is expanded */
    .sidebar-expanded [data-testid="stCustomComponentV1"] {
        left: calc((100% - 245px) / 2 + 245px);  /* 245px is default sidebar width */
        width: calc(min(800px, 100% - 245px - 2rem)) !important;
        transform: translateX(-50%);
    }

    /* When sidebar is collapsed */
    .sidebar-collapsed [data-testid="stCustomComponentV1"] {
        left: 50%;
        width: calc(min(800px, 100% - 2rem)) !important;
        transform: translateX(-50%);
    }
    </style>
    """,
    unsafe_allow_html=True,
)
with st.sidebar:
    st.markdown("test")
message = prompt(name="foo", placeholder="Hi there!", key="bar")
if message:
    st.write("Message:", message)
    # if images:
    #     for img in images:
    #         st.image(img)

# st.chat_input("Enter your message")
