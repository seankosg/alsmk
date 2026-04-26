import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";

// Auto-update service worker — surface new builds via toast (unified with BuildInfo chip)
const updateSW = registerSW({
  onNeedRefresh() {
    toast.info("새 버전이 배포되었습니다", {
      id: "new-build-available",
      description: "최신 기능을 적용하려면 새로고침하세요.",
      action: {
        label: "새로고침",
        onClick: () => updateSW(true),
      },
      duration: Infinity,
    });
  },
  onOfflineReady() {
    console.log("App ready for offline use");
  },
});

createRoot(document.getElementById("root")!).render(<App />);
