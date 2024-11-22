from pathlib import Path

import setuptools

this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text()

setuptools.setup(
    name="streamlit-chat-prompt",
    version="0.2.1",
    author="Tyler House",
    author_email="26489166+tahouse@users.noreply.github.com",
    description="Streamlit component that allows you to create a chat prompt with paste and image attachment support",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/tahouse/streamlit-chat-prompt",
    project_urls={
        "Documentation": "https://github.com/tahouse/streamlit-chat-prompt/blob/main/README.md",
        "Issue Tracker": "https://github.com/tahouse/streamlit-chat-prompt/issues",
    },
    packages=setuptools.find_packages(),
    include_package_data=True,
    license="Apache-2.0",
    keywords="streamlit, component, chat, prompt, paste, image, clipboard",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: Apache Software License",
        "Operating System :: OS Independent",
        "Development Status :: 5 - Production/Stable",
        "Environment :: Web Environment",
        "Intended Audience :: Developers",
        "Topic :: Desktop Environment",
        "Topic :: Multimedia :: Graphics",
        "Topic :: Software Development :: User Interfaces",
    ],
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
