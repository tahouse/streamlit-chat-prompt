from pathlib import Path

import setuptools

this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text()

setuptools.setup(
    name="streamlit-chat-prompt",
    version="0.1.6",
    author="Tyler House",
    author_email="26489166+tahouse@users.noreply.github.com",
    description="Streamlit component that allows you to create a chat prompt with paste and image attachment support",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/tahouse/streamlit-chat-prompt",
    packages=setuptools.find_packages(),
    include_package_data=True,
    classifiers=[],
    python_requires=">=3.7",
    install_requires=[
        # By definition, a Custom Component depends on Streamlit.
        # If your component has other Python dependencies, list
        # them here.
        "streamlit >= 0.63",
        "pydantic >= 2",
    ],
    extras_require={
        "devel": [
            "wheel",
            "setuptools==69.0.3",
            "pytest==7.4.0",
            "twine~=5.1",
        ]
    },
)
