import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Auto-update service worker — surface new builds via app-version-mismatch event,
// which both AppUpdateBanner (via useAppVersionCheck) and other listeners react to.
const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new Event("app-version-mismatch"));
  },
  onOfflineReady() {
    console.log("App ready for offline use");
  },
});

if (typeof window !== "undefined") {
  (window as any).__updateSW = updateSW;
}

createRoot(document.getElementById("root")!).render(<App />);
