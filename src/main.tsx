import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Auto-update service worker
const updateSW = registerSW({
  onNeedRefresh() {
    // Update SW and reload once (guard prevents loop)
    updateSW(true);
  },
  onOfflineReady() {
    console.log("App ready for offline use");
  },
});

createRoot(document.getElementById("root")!).render(<App />);
