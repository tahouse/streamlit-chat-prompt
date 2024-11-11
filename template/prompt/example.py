import streamlit as st
from prompt import prompt

# Add some test code to play with the component while it's in development.
# During development, we can run this just as we would any other Streamlit
# app: `$ streamlit run my_component/example.py`

st.subheader("Component with constant args")

# name_input = st.text_input("Enter a name", value="Streamlit")
prompt_output = prompt("bar", key="foo")
st.write(prompt_output)
if prompt_output:
    print("\n------------------------------------------------------")
    print(prompt_output)