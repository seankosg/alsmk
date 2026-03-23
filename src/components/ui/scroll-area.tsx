import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

function useCombinedRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return React.useCallback((node: T | null) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === "function") {
        ref(node);
        return;
      }
      (ref as React.MutableRefObject<T | null>).current = node;
    });
  }, [refs]);
}

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    scrollbarClassName?: string;
    viewportClassName?: string;
  }
>(({ className, children, scrollbarClassName, viewportClassName, ...props }, ref) => {
  const localRef = React.useRef<React.ElementRef<typeof ScrollAreaPrimitive.Root> | null>(null);
  const mergedRef = useCombinedRefs(ref, localRef);
  const [viewportHeight, setViewportHeight] = React.useState<number | undefined>(undefined);

  React.useLayoutEffect(() => {
    const root = localRef.current;
    if (!root) return;

    const updateViewportHeight = () => {
      const nextHeight = root.clientHeight;
      setViewportHeight(nextHeight > 0 ? nextHeight : undefined);
    };

    updateViewportHeight();

    const observer = new ResizeObserver(() => {
      updateViewportHeight();
    });

    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <ScrollAreaPrimitive.Root
      ref={mergedRef}
      type="always"
      className={cn("relative min-h-0 overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        className={cn("w-full min-h-0 rounded-[inherit]", viewportClassName)}
        style={viewportHeight ? { height: viewportHeight } : undefined}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar className={scrollbarClassName} />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
