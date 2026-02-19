import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { TOAST_DURATION_MS } from "../../utils/toast";
import { Button } from "src/components/ui";
const MOBILE_TOAST_QUERY = "(max-width: 768px)";

function getIsMobileToastViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_TOAST_QUERY).matches;
}

export function AppToaster() {
  const [isMobile, setIsMobile] = useState<boolean>(getIsMobileToastViewport);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(MOBILE_TOAST_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(media.matches);

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }

    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  return (
    <Toaster
      position={isMobile ? "bottom-center" : "bottom-right"}
      expand={false}
      closeButton={false}
      visibleToasts={4}
      toastOptions={{
        duration: TOAST_DURATION_MS,
      }}
    />
  );
}
