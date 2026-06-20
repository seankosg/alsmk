import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface TopHorizontalScrollbarProps {
  targetRef: React.RefObject<HTMLDivElement>;
  width: number;
  frozenWidth?: number;
  className?: string;
}

/**
 * 표 본문 상단에 미러링되는 가로 스크롤바. targetRef 컨테이너와 scrollLeft 양방향 동기화.
 */
export function TopHorizontalScrollbar({
  targetRef,
  width,
  frozenWidth = 0,
  className,
}: TopHorizontalScrollbarProps) {
  const selfRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const target = targetRef.current;
    const self = selfRef.current;
    if (!target || !self) return;
    const onTargetScroll = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      self.scrollLeft = target.scrollLeft;
      requestAnimationFrame(() => { isSyncingRef.current = false; });
    };
    target.addEventListener("scroll", onTargetScroll, { passive: true });
    self.scrollLeft = target.scrollLeft;
    return () => target.removeEventListener("scroll", onTargetScroll);
  }, [targetRef]);

  const handleSelfScroll = () => {
    const target = targetRef.current;
    const self = selfRef.current;
    if (!target || !self || isSyncingRef.current) return;
    isSyncingRef.current = true;
    target.scrollLeft = self.scrollLeft;
    requestAnimationFrame(() => { isSyncingRef.current = false; });
  };

  const innerWidth = Math.max(width, 1);

  return (
    <div className={cn("flex h-[16px] shrink-0 border-b bg-muted/30", className)} aria-hidden>
      {frozenWidth > 0 && (
        <div style={{ width: frozenWidth, minWidth: frozenWidth }} className="border-r bg-background" />
      )}
      <div ref={selfRef} onScroll={handleSelfScroll} className="h-full flex-1 overflow-x-auto overflow-y-hidden">
        <div style={{ width: innerWidth, height: 1 }} />
      </div>
    </div>
  );
}
