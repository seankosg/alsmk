import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

declare global {
  interface Window {
    __updateSW?: (reload?: boolean) => Promise<void> | void;
  }
}

/**
 * 신버전 감지 시 표시되는 전역 모달.
 * `window.dispatchEvent(new CustomEvent("new-build-available"))` 로 트리거.
 * 한 세션당 자동으로는 1회만 열림. 닫아도 헤더 BuildInfo 칩에서 다시 새로고침 가능.
 */
export function NewBuildDialog() {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const handler = () => {
      if (shown) return;
      setShown(true);
      setOpen(true);
    };
    window.addEventListener("new-build-available", handler);
    return () => window.removeEventListener("new-build-available", handler);
  }, [shown]);

  const handleRefresh = () => {
    if (typeof window.__updateSW === "function") {
      window.__updateSW(true);
    } else {
      window.location.reload();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>새 버전이 배포되었습니다</AlertDialogTitle>
          <AlertDialogDescription>
            최신 기능과 버그 수정을 적용하려면 페이지를 새로고침해주세요.
            작성 중인 내용이 있다면 먼저 저장 후 진행하세요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>나중에</AlertDialogCancel>
          <AlertDialogAction onClick={handleRefresh}>지금 새로고침</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
