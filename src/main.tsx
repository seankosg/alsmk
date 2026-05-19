import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Auto-update service worker — surface new builds via global modal (NewBuildDialog)
const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent("new-build-available"));
  },
  onOfflineReady() {
    console.log("App ready for offline use");
  },
});

// 다이얼로그의 "지금 새로고침" 버튼이 PWA 갱신을 트리거할 수 있도록 전역에 노출
if (typeof window !== "undefined") {
  window.__updateSW = updateSW;
}

createRoot(document.getElementById("root")!).render(<App />);
