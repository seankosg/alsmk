import { useEffect, useRef, useState } from "react";
import { Hammer } from "lucide-react";
import { cn } from "@/lib/utils";

interface BuildInfoProps {
  inline?: boolean;
}

const CHECK_INTERVAL = 5 * 60 * 1000; // 5분

function formatBuildTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yy}.${mm}.${dd} ${hh}:${mi}`;
  } catch {
    return "—";
  }
}

/**
 * Build version chip — displays current build timestamp and polls for new builds.
 * Detects new deployments by comparing the hashed entry script src in /index.html.
 */
export function BuildInfo({ inline = false }: BuildInfoProps) {
  const buildTime = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : new Date().toISOString();
  const [hasUpdate, setHasUpdate] = useState(false);
  const initialScriptRef = useRef<string | null>(null);

  useEffect(() => {
    // Capture current entry script src on mount
    const current = document.querySelector('script[type="module"][src*="index"]')?.getAttribute("src")
      || document.querySelector('script[type="module"]')?.getAttribute("src")
      || null;
    initialScriptRef.current = current;

    let cancelled = false;

    const check = async () => {
      if (cancelled || hasUpdate) return;
      try {
        const res = await fetch(`/index.html?_=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok) return;
        const html = await res.text();

        // Try to find the entry script in the fetched HTML
        const matches = Array.from(html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g));
        const remoteScript = matches.find((m) => m[1].includes("index"))?.[1] || matches[0]?.[1] || null;

        if (remoteScript && initialScriptRef.current && remoteScript !== initialScriptRef.current) {
          setHasUpdate(true);
          window.dispatchEvent(new CustomEvent("new-build-available"));
        }
      } catch {
        // Network/parse errors silently ignored
      }
    };

    // Initial check after 30s, then every 5min
    const initialTimer = window.setTimeout(check, 30_000);
    const intervalId = window.setInterval(check, CHECK_INTERVAL);

    // Also re-check when tab becomes visible
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hasUpdate]);

  const formatted = formatBuildTime(buildTime);
  const title = hasUpdate
    ? "새 버전이 있습니다 — 클릭하여 새로고침"
    : `Build: ${buildTime}`;

  return (
    <button
      type="button"
      onClick={() => {
        if (hasUpdate) window.location.reload();
      }}
      title={title}
      className={cn(
        "font-mono text-[10px] leading-none px-2 py-1 rounded-full border inline-flex items-center gap-1 transition-colors",
        hasUpdate
          ? "border-primary text-primary bg-primary/10 cursor-pointer animate-pulse hover:bg-primary/20"
          : "border-border/60 text-muted-foreground/70 cursor-default",
        inline ? "" : "self-start",
      )}
      aria-label={title}
    >
      <Hammer className="h-3 w-3 shrink-0" />
      <span className="hidden sm:inline">{formatted}</span>
      {hasUpdate && <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" aria-hidden />}
    </button>
  );
}
