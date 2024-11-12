
# Streamlit Chat Prompt

A Streamlit component that provides a modern chat-style prompt with image attachment and paste support. This component was built to mimic the style of [streamlit.chat_input](https://docs.streamlit.io/develop/api-reference/chat/st.chat_input) while expanding functionality with images. Future work may include addition of speech-to-text input.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Author:** Tyler House ([@tahouse](https://github.com/tahouse))

## Features

- 📝 Chat-style text input with multi-line support
- 📎 Image attachment support via button or drag-and-drop
- 📋 Paste image support (paste images directly from clipboard)
- 🖼️ Image preview with ability to remove attached images
- ⌨️ Submit with Enter key (Shift+Enter for new line)
- 🎨 Automatic theme integration with Streamlit
- 📱 Responsive design that works well on mobile and desktop
- 🗜️ Automatic image compression/scaling to stay under size limits (customizable, default 5MB)
- 📌 Optional pinned-to-bottom placement for main chat interface (one per app)
- 🔄 Flexible positioning for use in dialogs, sidebars, or anywhere in the app flow
- ✏️ Support for default/editable content - perfect for message editing workflows
- 🔤 Smart focus management - automatically returns to text input after interactions

## Installation

```bash
pip install streamlit-chat-prompt
```

## Usage

```python
import streamlit as st
from streamlit_chat_prompt import prompt

# Create a chat prompt
response = prompt(
    name="chat",  # Unique name for the prompt
    key="chat",   # Unique key for the component instance
    placeholder="Hi there! What should we talk about?",  # Optional placeholder text
    main_bottom=True,  # Pin prompt to bottom of main area
    max_image_size=5 * 1024 * 1024,  # Maximum image size (5MB default)
    disabled=False,  # Optionally disable the prompt
)

# Handle the response
if response:
    if response.message:
        st.write(f"Message: {response.message}")
    
    if response.images:
        for i, img in enumerate(response.images):
            st.write(f"Image {i+1}: {img.type} ({img.format})")
```

## Examples

Here are some usage patterns, or check out [rocktalk](https://github.com/tahouse/rocktalk) for a full working example.

1. Main Chat Interface ![Main Chat Interface](screenshots/main-chat.png)

    ```python
    import streamlit as st
    from streamlit_chat_prompt import prompt

    with st.sidebar:
        st.markdown("test")
        prompt_return = prompt(name="foo", key="better_chat_prompt", placeholder="Hi there!", main_bottom=True)

    st.write("Message:", prompt_return)
    if prompt_return:
        prompt_return.message
        prompt_return.images

    ```

2. Dialog Usage and Starting From Existing Message ![Dialog Interface](screenshots/dialog.png)

    ```python
    import streamlit as st
    from streamlit_chat_prompt import prompt

    @st.dialog("test dialog")
    def test_dg(default_input="foobar"):
        prompt(
            "edit prompt",
            key=f"edit_prompt_{id(self)}",
            placeholder="Editing existing input",
            main_bottom=False,
            default=default_input,
        )
    
        if st.button("✎", key=f"edit_{id(self)}"):
            test_dg()

    ```

## Component API

### prompt()

Main function to create a chat prompt.

Parameters:

- `name` (str): Unique name for this prompt instance
- `key` (str): Unique key for the component instance
- `placeholder` (str, optional): Placeholder text shown in input field
- `default` (Union[str, PromptReturn], optional): Default value for the prompt. Can include text and images using the `PromptReturn` object type.
- `main_bottom` (bool, optional): Pin prompt to bottom of main area (default: True)
- `max_image_size` (int, optional): Maximum image size in bytes (default: 5MB)
- `disabled` (bool, optional): Disable the prompt (default: False)

Returns:

`Optional[PromptReturn]`: Object containing message and images if submitted, None otherwise

### PromptReturn

Object returned when user submits the prompt.

Properties:

- `message` (Optional[str]): Text message entered by user
- `images` (Optional[List[ImageData]]): List of attached images

### ImageData

Object representing an attached image.

Properties:

- `type` (str): Image MIME type (e.g. "image/jpeg")
- `format` (str): Image format (e.g. "base64")
- `data` (str): Image data as base64 string

## Development

This repository is based on the [Streamlit Component template system](https://github.com/streamlit/component-template). If you want to modify or develop the component:

1. Clone the repository
2. Install development dependencies:

    ```sh
    pip install -e ".[devel]"
    ```

3. Start the frontend development server:

    ```sh
    cd streamlit_chat_prompt/frontend
    npm install
    npm run start
    ```

4. In a separate terminal, run your Streamlit app:

    ```sh
    streamlit run your_app.py
    ```

## License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.
