import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

const STORAGE_KEY = "bb.home.stickyCta.dismissed.v1";

function safeReadLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteLocalStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // noop
  }
}

export default function StickyMobileCta(props: {
  ctaLabel: string;
  onPrimaryCtaClick: () => void;
}) {
  const { ctaLabel, onPrimaryCtaClick } = props;
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return safeReadLocalStorage(STORAGE_KEY) === "1";
  });
  const [isMobile, setIsMobile] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hideForFooterCta, setHideForFooterCta] = useState(false);

  const rafRef = useRef<number | null>(null);
  const footerObserverRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
    update();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    // Safari fallback.
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  const canShow = useMemo(() => isMobile && !dismissed, [dismissed, isMobile]);

  useEffect(() => {
    if (!canShow) {
      setHideForFooterCta(false);
      if (footerObserverRef.current) {
        footerObserverRef.current.disconnect();
        footerObserverRef.current = null;
      }
      return;
    }

    const footerCta = document.querySelector("[data-testid='home-footer-primary-cta']");
    if (!footerCta) {
      setHideForFooterCta(false);
      return;
    }

    const computeFallback = () => {
      const rect = footerCta.getBoundingClientRect();
      const isIntersecting = rect.top < window.innerHeight && rect.bottom > 0;
      setHideForFooterCta(isIntersecting);
    };

    if (typeof IntersectionObserver === "undefined") {
      computeFallback();
      window.addEventListener("scroll", computeFallback, { passive: true });
      window.addEventListener("resize", computeFallback);
      return () => {
        window.removeEventListener("scroll", computeFallback);
        window.removeEventListener("resize", computeFallback);
      };
    }

    footerObserverRef.current?.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setHideForFooterCta(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.01 },
    );
    footerObserverRef.current = observer;
    observer.observe(footerCta);

    return () => observer.disconnect();
  }, [canShow]);

  useEffect(() => {
    if (!canShow) {
      setVisible(false);
      return;
    }

    const update = () => {
      const y = window.scrollY || 0;
      // Show only after the hero (avoid covering the above-the-fold CTA).
      setVisible(y > 320);
    };

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        update();
      });
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [canShow]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    safeWriteLocalStorage(STORAGE_KEY, "1");
  }, []);

  if (!canShow || !visible || hideForFooterCta) return null;

  return (
    <div className="home-sticky" role="region" aria-label="Acceso rápido">
      <div className="home-sticky__inner">
        <Link
          to="/auth/registro"
          state={{ from: "/planes" }}
          className="home-cta home-cta--primary home-sticky__cta"
          onClick={onPrimaryCtaClick}
        >
          <span className="home-sticky__cta-label">{ctaLabel}</span>
          <span className="home-sticky__cta-micro">Cancela cuando quieras</span>
        </Link>
        <button type="button" className="home-sticky__close" onClick={dismiss} aria-label="Ocultar barra">
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
