import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

// Cancel the "taking too long" fallback message since React mounted successfully
if (window.__laforjaLoadTimer) {
  clearTimeout(window.__laforjaLoadTimer);
}
