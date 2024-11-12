import streamlit as st
from streamlit_chat_prompt import prompt

with st.sidebar:
    st.markdown("test")
prompt_return = prompt(
    name="foo", key="better_chat_prompt", placeholder="Hi there!", main_bottom=True
)

st.write("Message:", prompt_return)
if prompt_return:
    prompt_return.message
    prompt_return.images
