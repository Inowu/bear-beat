import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "src/icons";

const STORAGE_KEY = "bb.plans.stickyCta.dismissed.v1";

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

export default function PlansStickyCta(props: {
  planId: number | null;
  ctaLabel: string;
  trial: { enabled: boolean; days: number; gb: number } | null;
  onClick: () => void;
  onDemoClick: () => void;
}) {
  const { planId, ctaLabel, trial, onClick, onDemoClick } = props;
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return safeReadLocalStorage(STORAGE_KEY) === "1";
  });
  const [isMobile, setIsMobile] = useState(false);
  const [hideForHero, setHideForHero] = useState(false);
  const [hideForPrimaryCta, setHideForPrimaryCta] = useState(false);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 720px)");
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

  const canShow = useMemo(() => isMobile && !dismissed && Boolean(planId), [dismissed, isMobile, planId]);

  useEffect(() => {
    if (!canShow) {
      setHideForHero(false);
      return;
    }

    const hero = document.querySelector("[data-testid='plans-hero']");
    if (!hero) {
      setHideForHero(false);
      return;
    }

    const computeFallback = () => {
      const rect = hero.getBoundingClientRect();
      const isIntersecting = rect.top < window.innerHeight && rect.bottom > 0;
      setHideForHero(isIntersecting);
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

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setHideForHero(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.01 },
    );
    observer.observe(hero);
    computeFallback();

    return () => observer.disconnect();
  }, [canShow]);

  useEffect(() => {
    if (!canShow || !planId) {
      setHideForPrimaryCta(false);
      return;
    }

    const selector = `[data-testid='plan-primary-cta-${planId}']`;
    const el = document.querySelector(selector);
    if (!el) {
      setHideForPrimaryCta(false);
      return;
    }

    const computeFallback = () => {
      const rect = el.getBoundingClientRect();
      const isIntersecting = rect.top < window.innerHeight && rect.bottom > 0;
      setHideForPrimaryCta(isIntersecting);
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

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setHideForPrimaryCta(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.01 },
    );
    observer.observe(el);
    computeFallback();

    return () => observer.disconnect();
  }, [canShow, planId]);

  useEffect(() => {
    if (!canShow) {
      setVisible(false);
      return;
    }

    const update = () => {
      const doc = document.documentElement;
      const isNearBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 220;
      setVisible(!hideForPrimaryCta && !hideForHero && !isNearBottom);
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
  }, [canShow, hideForHero, hideForPrimaryCta]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    safeWriteLocalStorage(STORAGE_KEY, "1");
  }, []);

  const stickyMicro =
    trial?.enabled && Number.isFinite(trial.days) && trial.days > 0
      ? `Con tarjeta: hoy $0 (${trial.days} días de prueba)`
      : "Cancela cuando quieras";

  if (!canShow || !visible) return null;

  return (
    <div className="plans-sticky" role="region" aria-label="Acceso rápido">
      <div className="plans-sticky__inner">
        <button type="button" className="plans-sticky__cta" onClick={onClick}>
          <span className="plans-sticky__cta-label">{ctaLabel}</span>
          <span className="plans-sticky__cta-micro">{stickyMicro}</span>
        </button>
        <button type="button" className="plans-sticky__demo" onClick={onDemoClick}>
          Ver demo
        </button>
        <button type="button" className="plans-sticky__close" onClick={dismiss} aria-label="Ocultar barra">
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
