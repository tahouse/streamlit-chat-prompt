import os
from types import FrameType

from pydantic import BaseModel
from streamlit.components.types.base_component_registry import BaseComponentRegistry
import inspect
import streamlit.components.v1 as components
from streamlit.components.v1.custom_component import CustomComponent
import streamlit as st
from dataclasses import dataclass
from typing import Any, Callable, List, Optional
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state.widgets import register_widget
from pprint import pformat
from streamlit.runtime import get_instance
from streamlit.components.types.base_custom_component import BaseCustomComponent
from streamlit.dataframe_util import is_dataframe_like
from streamlit.delta_generator_singletons import get_dg_singleton_instance
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.policies import check_cache_replay_rules
from streamlit.elements.lib.utils import compute_and_register_element_id
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Components_pb2 import ArrowTable as ArrowTableProto
from streamlit.proto.Components_pb2 import SpecialArg
from streamlit.proto.Element_pb2 import Element
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import register_widget
from streamlit.type_util import is_bytes_like, to_bytes

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


_prompt_singleton_key: Optional[str] = None


# Create a wrapper function for the component. This is an optional
# best practice - we could simply expose the component function returned by
# `declare_component` and call it done. The wrapper allows us to customize
# our component's API: we can pre-process its input args, post-process its
# output value, and add a docstring for users.
def prompt(
    name: str, key: str, placeholder="Hi there! What should we talk about?"
) -> Optional[PromptReturn]:
    """Create a chat-like prompt input at the bottom of the page.

    This function creates a single chat-like prompt input component that appears fixed
    at the bottom of the Streamlit app. It allows users to enter text and submit it.

    Args:
        name (str): A unique identifier for this prompt instance. Used internally
            for managing state.
        key (str): Used to ensure only a single prompt can be created.
        placeholder (str, optional): The placeholder text shown in the input field
            before the user enters anything. Defaults to "Hi there! What should we
            talk about?".

    Returns:
        Optional[PromptReturn]: Returns a PromptReturn object containing the text
        entered by the user when submitted, or None if nothing has been submitted yet.

    Raises:
        RuntimeError: If multiple prompt instances are detected in the app.

    Note:
        Currently only one prompt instance is supported per app. The prompt appears
        fixed at the bottom of the page above any padding/margins.
    """
    global _prompt_singleton_key

    if _prompt_singleton_key and _prompt_singleton_key != key:
        raise RuntimeError(
            "Multiple prompt instances detected. Only one prompt component can be used per Streamlit app. "
            "Please ensure you're only creating a single prompt instance in your application."
        )

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

    ctx = get_script_run_ctx()

    # Call through to our private component function. Arguments we pass here
    # will be sent to the frontend, where they'll be available in an "args"
    # dictionary.
    #
    # "default" is a special argument that specifies the initial return
    # value of the component before the user has interacted with it.
    if f"chat_prompt_{key}_prev_uuid" not in ctx.session_state:
        ctx.session_state[f"chat_prompt_{key}_prev_uuid"] = None

    component_value = _component_func(
        name=name, placeholder=placeholder, default=None, key=key
    )
    _prompt_singleton_key = key

    if (
        component_value
        and component_value["uuid"] != ctx.session_state[f"chat_prompt_{key}_prev_uuid"]
    ):
        # we have a new message
        ctx.session_state[f"chat_prompt_{key}_prev_uuid"] = component_value["uuid"]
        images = []
        if component_value.get("images"):
            for image_str in component_value["images"]:
                # Assuming the image_str is in the format: "data:image/png;base64,iVBORw0KGgo..."
                parts = image_str.split(";")
                image_type = parts[0].split(":")[1]
                image_format, image_data = parts[1].split(",")
                images.append(
                    ImageData(type=image_type, format=image_format, data=image_data)
                )

        return PromptReturn(
            message=component_value.get("message"),
            # ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALYAAAFOCAYAAAArRufEAAAKsWlDQ1BJQ0MgUHJvZmlsZQAASImVlwdUU+kSgP970xstEIqUUEMRpBNASggtFOnVRkgCBEKIgaAiNkRcwRVFRAQsoKsiCq4FkMWGBduiqNh1QURBXRcLNlTeDRyCu++8986bcybzZe7888/85/7nzAWAosuVSESwCgCZ4hxpZIAPPT4hkY4bBCSABlTgBGy5vGwJKzw8BCAyaf8uH24DSG5vWstz/fvz/yqq...
            images=images,
        )
    else:
        # either nothing new, or we've already seen this value
        return None
