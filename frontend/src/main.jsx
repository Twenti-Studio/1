import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SiteSettingsProvider } from "./context/SiteSettingsContext";
import { UserAuthProvider } from "./context/UserAuthContext";
import "./index.css";

// Register service worker for PWA install on /chat
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* ignore */ });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <SiteSettingsProvider>
        <UserAuthProvider>
          <App />
        </UserAuthProvider>
      </SiteSettingsProvider>
    </BrowserRouter>
  </React.StrictMode>
);
