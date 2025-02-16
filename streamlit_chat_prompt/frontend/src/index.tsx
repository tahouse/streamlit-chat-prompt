import React from "react";
import ReactDOM from "react-dom";
import { withStreamlitConnection } from "streamlit-component-lib";
import { ChatInput } from "./components/ChatInput";

// Create the connected component
const Prompt = withStreamlitConnection(ChatInput);

// Render with proper typing
ReactDOM.render(
  <React.StrictMode>
    <Prompt />
  </React.StrictMode>,
  document.getElementById("root")
);