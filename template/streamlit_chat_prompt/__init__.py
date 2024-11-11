import os
from typing import List, Optional, Union

import streamlit as st
import streamlit.components.v1 as components
from pydantic import BaseModel
import math
from PIL import Image
import io
import base64
import logging

logger = logging.getLogger("streamlit_chat_prompt")
logger.setLevel(logging.DEBUG)

# Add handler if needed
handler = logging.StreamHandler()
handler.setFormatter(
    logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
)
logger.addHandler(handler)
# Create a _RELEASE constant. We'll set this to False while we're developing
# the component, and True when we're ready to package and distribute it.
# (This is, of course, optional - there are innumerable ways to manage your
# release process.)
_RELEASE = True

# Declare a Streamlit component. `declare_component` returns a function
# that is used to create instances of the component. We're naming this
# function "_component_func", with an underscore prefix, because we don't want
# to expose it directly to users. Instead, we will create a custom wrapper
# function, below, that will serve as our component's public API.

# It's worth noting that this call to `declare_component` is the
# *only thing* you need to do to create the binding between Streamlit and
# your component frontend. Everything else we do in this file is simply a
# best practice.

if not _RELEASE:
    _component_func = components.declare_component(
        # We give the component a simple, descriptive name ("my_component"
        # does not fit this bill, so please choose something better for your
        # own component :)
        "prompt",
        # Pass `url` here to tell Streamlit that the component will be served
        # by the local dev server that you run via `npm run start`.
        # (This is useful while your component is in development.)
        url="http://localhost:3001",
    )
else:
    # When we're distributing a production version of the component, we'll
    # replace the `url` param with `path`, and point it to the component's
    # build directory:
    parent_dir = os.path.dirname(os.path.abspath(__file__))
    build_dir = os.path.join(parent_dir, "frontend/build")
    _component_func = components.declare_component("prompt", path=build_dir)


class ImageData(BaseModel):
    type: str
    format: str
    data: str


class PromptReturn(BaseModel):
    message: Optional[str] = None
    images: Optional[List[ImageData]] = None


_prompt_main_singleton_key: Optional[str] = None


def _process_image(
    image_str: str, max_b64_size: int = 5 * 1024 * 1024
) -> Optional[ImageData]:
    """Process and resize an image to ensure it's under the size limit."""
    # Parse data URI
    parts = image_str.split(";")
    image_type = parts[0].split(":")[1]
    image_format = parts[1].split(",")[0]
    image_data = parts[1].split(",")[1]

    # Check current size
    b64_size = len(image_data)
    logger.info(
        f"User input {image_type} image with size {b64_size / 1024 / 1024:.2f}MB is {'greater than' if b64_size > max_b64_size else 'less than'} max allowed size of {max_b64_size/ 1024 / 1024:.2f}MB."
    )

    if b64_size <= max_b64_size:
        return ImageData(type=image_type, format=image_format, data=image_data)

    # Load image
    binary_data = base64.b64decode(image_data)
    img = Image.open(io.BytesIO(binary_data))

    # Try compression only first
    for i, quality in enumerate([100, 90, 80]):
        output = io.BytesIO()
        img.save(output, format="JPEG", quality=quality, optimize=True)
        new_data = base64.b64encode(output.getvalue()).decode("utf-8")
        new_size = len(new_data)

        logger.debug(
            f"Attempt {i} using only compression to reduce size with quality={quality}: new base64 size: {new_size / 1024 / 1024:.2f}MB"
        )

        if new_size <= max_b64_size:
            return ImageData(type="image/jpeg", format="base64", data=new_data)

    # If compression alone didn't work, then try scaling
    scale_factor = 0.95
    quality = 95

    # Now try scaling if needed
    for i, attempt in enumerate(range(5)):
        new_width = int(img.width * scale_factor)
        new_height = int(img.height * scale_factor)

        resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Convert to RGB if needed
        if resized_img.mode in ("RGBA", "LA"):
            background = Image.new("RGB", resized_img.size, (255, 255, 255))
            background.paste(resized_img, mask=resized_img.split()[-1])
            resized_img = background

        output = io.BytesIO()
        resized_img.save(output, format="JPEG", quality=quality, optimize=True)
        new_data = base64.b64encode(output.getvalue()).decode("utf-8")
        new_size = len(new_data)
        logger.debug(
            f"Attempt {i} using only scaling to reduce size with scale factor {scale_factor:.2f}x: new dimensions {new_width}x{new_height} and base64 size: {new_size / 1024 / 1024:.2f}MB"
        )

        if new_size <= max_b64_size:
            return ImageData(type="image/jpeg", format="base64", data=new_data)

        scale_factor *= 0.95
        quality = int(quality * 0.95)

    logger.error("Failed to compress image below size limit, ")
    return None


# Create a wrapper function for the component. This is an optional
# best practice - we could simply expose the component function returned by
# `declare_component` and call it done. The wrapper allows us to customize
# our component's API: we can pre-process its input args, post-process its
# output value, and add a docstring for users.
def prompt(
    name: str,
    key: str,
    placeholder="Hi there! What should we talk about?",
    default: Optional[Union[str, PromptReturn]] = None,
    main_bottom: bool = True,
    max_image_size: int = 5 * 1024 * 1024,  # 5MB
) -> Optional[PromptReturn]:
    """Create a chat-like prompt input at the bottom of the page.

    Args:
        name (str): A unique identifier for this prompt instance.
        key (str): Used to ensure only a single prompt can be created.
        placeholder (str, optional): The placeholder text shown in the input field.
        default (Union[str, PromptReturn], optional): Default value for the prompt.
            Can be either a string (text only) or PromptReturn object (text and images).
        main_bottom (bool, optional): Whether to position at bottom of main area.

    Returns:
        Optional[PromptReturn]: Returns a PromptReturn object containing the text
        and images entered by the user when submitted, or None if nothing submitted yet.
    """
    # Convert string default to PromptReturn if needed
    if isinstance(default, str):
        default = PromptReturn(message=default)

    if f"chat_prompt_{key}_prev_uuid" not in st.session_state:
        st.session_state[f"chat_prompt_{key}_prev_uuid"] = None

    # Convert images to base64 strings if present in default
    default_value = None
    if default:
        images = []
        if default.images:
            images = [
                f"data:{img.type};{img.format},{img.data}" for img in default.images
            ]
        default_value = {
            "message": default.message or "",
            "images": images,
            "uuid": None,  # No UUID for default value
        }

    if main_bottom:
        global _prompt_main_singleton_key

        if _prompt_main_singleton_key and _prompt_main_singleton_key != key:
            raise RuntimeError(
                "Multiple prompt instances detected. Only one prompt component can be used per Streamlit app. "
                "Please ensure you're only creating a single prompt instance in your application."
            )
        _prompt_main_singleton_key = key

        # pin prompt to bottom of main area
        st.markdown(
            f"""
        <style>
        .st-key-{key}"""
            + """ {
            position: fixed;
            bottom: 1rem;
            z-index: 1000;
        }

        /* Main content area */
        section[data-testid="stMain"] {
            margin-bottom: 100px;  /* Make room for the fixed component */
        }

        /* When sidebar is expanded */
        """
            + f""".sidebar-expanded .st-key-{key}"""
            + """ {
            left: calc((100% - 245px) / 2 + 245px);  /* 245px is default sidebar width */
            width: calc(min(800px, 100% - 245px - 2rem)) !important;
            transform: translateX(-50%);
        }

        /* When sidebar is collapsed */
        """
            + f""".sidebar-collapsed .st-key-{key}"""
            + """ {
            left: 50%;
            width: calc(min(800px, 100% - 2rem)) !important;
            transform: translateX(-50%);
        }
        </style>
        """,
            unsafe_allow_html=True,
        )

    # Call through to our private component function. Arguments we pass here
    # will be sent to the frontend, where they'll be available in an "args"
    # dictionary.
    #
    # "default" is a special argument that specifies the initial return
    # value of the component before the user has interacted with it.
    component_value = _component_func(
        name=name, placeholder=placeholder, default=default_value, key=key
    )

    if (
        component_value
        and component_value["uuid"] != st.session_state[f"chat_prompt_{key}_prev_uuid"]
    ):
        # we have a new message
        st.session_state[f"chat_prompt_{key}_prev_uuid"] = component_value["uuid"]
        images = []
        # Process any images
        if component_value.get("images"):
            for image_str in component_value["images"]:
                processed_image = _process_image(
                    image_str=image_str, max_b64_size=max_image_size
                )
                if processed_image:
                    images.append(processed_image)
                else:
                    st.toast(
                        f"Could not resize image to less than {max_image_size / 1024 / 1024:.0f}MB. Try with a smaller image size or increase the maximum size allowed."
                    )
                    return None
        return PromptReturn(
            message=component_value.get("message"),
            images=images,
        )
    else:
        return None
