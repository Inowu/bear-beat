import AsideNavbar from "../components/AsideNavbar/AsideNavbar";
import { Outlet, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import Navbar from "../components/Navbar/Navbar";
import { useUserContext } from "../contexts/UserContext";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useDownloadContext } from "../contexts/DownloadContext";
import { FileLoader } from "../components/FileLoader/FileLoader";
import { applyRouteSeo } from "../utils/seo";
import { GROWTH_METRICS, trackGrowthMetricBridge } from "../utils/growthMetricsBridge";
import { queueHotjarStateChange } from "../utils/hotjarBridge";
import {
  clearAdminAccessBackup,
  getAdminAccessBackup,
} from "../utils/authStorage";
import {
  MOBILE_LIBRARY_ROOT_EVENT,
  MOBILE_LIBRARY_ROOT_STORAGE_KEY,
  MOBILE_SEARCH_QUERY_STORAGE_KEY,
  MOBILE_SEARCH_SUBMIT_EVENT,
} from "../constants/mobileNavigation";
import { Folder, House, Search, UserRound, X } from "src/icons";
import "./MainLayout.scss";

type MobileTabId = "home" | "search" | "library" | "account";

function MainLayout() {
  const { userToken, currentUser, handleLogin } = useUserContext();
  const { showDownload } = useDownloadContext();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  const [asideOpen, setAsideOpen] = useState<boolean>(false);
  const [showImpersonationBanner, setShowImpersonationBanner] = useState<boolean>(
    () => Boolean(getAdminAccessBackup()),
  );
  const [isMobileTabViewport, setIsMobileTabViewport] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });
  const [mobileTab, setMobileTab] = useState<MobileTabId>(() => {
    if (typeof window === "undefined") return "home";
    return window.location.pathname.startsWith("/micuenta") ? "account" : "home";
  });
  const [showMobileSearchOverlay, setShowMobileSearchOverlay] = useState<boolean>(false);
  const [mobileSearchValue, setMobileSearchValue] = useState<string>("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const trackedPathRef = useRef<string>("");

  const handleAsideHide = () => {
    menuButtonRef.current?.focus();
    setAsideOpen(false);
  };

  useEffect(() => {
    setAsideOpen(false);
  }, [location]);

  useEffect(() => {
    setShowImpersonationBanner(Boolean(getAdminAccessBackup()));
  }, [location.pathname, location.search, userToken]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 768px)");

    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsMobileTabViewport(event.matches);
    };

    setIsMobileTabViewport(mediaQuery.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleMediaChange);
    } else {
      mediaQuery.addListener(handleMediaChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleMediaChange);
      } else {
        mediaQuery.removeListener(handleMediaChange);
      }
    };
  }, []);

  const handleReturnToAdmin = () => {
    const adminAccessBackup = getAdminAccessBackup();
    if (!adminAccessBackup) return;

    handleLogin(adminAccessBackup.adminToken, adminAccessBackup.adminRefreshToken);
    clearAdminAccessBackup();
    setShowImpersonationBanner(false);
    navigate("/admin/usuarios");
  };

  useEffect(() => {
    // Scroll behavior by route:
    // - If there is a hash, let the destination surface handle anchor alignment.
    // - For "/" without hash, always reset to top (including back/forward).
    // - For the rest, preserve POP restoration and only force top on normal nav.
    if (typeof window === "undefined") return;
    if (location.hash) return;
    if (location.pathname === "/") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    if (navigationType === "POP") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search, location.hash, navigationType]);

  useEffect(() => {
    applyRouteSeo(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const currentKey = `${location.pathname}${location.search}`;
    if (trackedPathRef.current === currentKey) return;
    trackedPathRef.current = currentKey;

    const section =
      location.pathname.startsWith("/admin")
        ? "admin"
        : location.pathname.startsWith("/auth")
          ? "auth"
          : location.pathname.startsWith("/planes")
            ? "planes"
            : location.pathname === "/"
              ? "home"
              : "app";

    trackGrowthMetricBridge(GROWTH_METRICS.PAGE_VIEW, {
      pagePath: location.pathname,
      pageQuery: location.search,
      section,
    });

    // Hotjar SPA state change (conversion surfaces only, see utils/hotjar.ts).
    queueHotjarStateChange(currentKey);
  }, [location.pathname, location.search]);

  const isFullWidth =
    location.pathname === "/" ||
    location.pathname.startsWith("/auth") ||
    location.pathname.startsWith("/planes") ||
    location.pathname.startsWith("/instrucciones") ||
    location.pathname.startsWith("/legal") ||
    location.pathname.startsWith("/comprar");

  // Checkout / compra debe ser una superficie de foco (sin chrome lateral superior)
  // para reducir distracciones y mejorar conversión.
  const isCheckoutSurface = location.pathname.startsWith("/comprar");

  // Superficies "marketing" (publicas) que traen su propio topnav y no deben
  // mezclar chrome del producto, aunque exista sesion.
  const isMarketingSurface =
    location.pathname.startsWith("/planes") ||
    location.pathname.startsWith("/instrucciones") ||
    location.pathname.startsWith("/legal");

  const showAppChrome = Boolean(userToken) && !isCheckoutSurface && !isMarketingSurface;
  const isAdminRoute = location.pathname.startsWith("/admin");
  const showMobileTabBar = showAppChrome && !isAdminRoute && isMobileTabViewport;

  useEffect(() => {
    if (!showMobileTabBar) {
      setShowMobileSearchOverlay(false);
      setMobileSearchValue("");
      return;
    }

    if (location.pathname.startsWith("/micuenta")) {
      setMobileTab("account");
      return;
    }

    if (location.pathname !== "/") {
      setMobileTab("home");
      return;
    }

    if (mobileTab === "account") {
      setMobileTab("home");
    }
  }, [location.pathname, mobileTab, showMobileTabBar]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("bb-mobile-tabbar-visible", showMobileTabBar);
    return () => {
      document.body.classList.remove("bb-mobile-tabbar-visible");
    };
  }, [showMobileTabBar]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const shouldLockScroll = showMobileTabBar && showMobileSearchOverlay;
    document.body.classList.toggle("bb-mobile-search-open", shouldLockScroll);
    return () => {
      document.body.classList.remove("bb-mobile-search-open");
    };
  }, [showMobileSearchOverlay, showMobileTabBar]);

  useEffect(() => {
    if (!showMobileSearchOverlay) return;
    mobileSearchInputRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMobileSearchOverlay(false);
        setMobileTab(location.pathname.startsWith("/micuenta") ? "account" : "home");
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [location.pathname, showMobileSearchOverlay]);

  const queueMobileSearch = (query: string) => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(MOBILE_SEARCH_QUERY_STORAGE_KEY, query);
    } catch {
      // no-op: storage can be unavailable in private contexts
    }
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(MOBILE_SEARCH_SUBMIT_EVENT, {
          detail: { query },
        }),
      );
    }, 0);
  };

  const queueLibraryRootNavigation = () => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(MOBILE_LIBRARY_ROOT_STORAGE_KEY, "1");
    } catch {
      // no-op: storage can be unavailable in private contexts
    }
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(MOBILE_LIBRARY_ROOT_EVENT));
    }, 0);
  };

  const closeMobileSearchOverlay = () => {
    setShowMobileSearchOverlay(false);
    setMobileTab(location.pathname.startsWith("/micuenta") ? "account" : "home");
  };

  const handleMobileHomeTab = () => {
    setMobileTab("home");
    setShowMobileSearchOverlay(false);
    setAsideOpen(false);
    navigate("/");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
  };

  const handleMobileLibraryTab = () => {
    setMobileTab("library");
    setShowMobileSearchOverlay(false);
    setAsideOpen(false);
    navigate("/");
    queueLibraryRootNavigation();
  };

  const handleMobileSearchTab = () => {
    setMobileTab("search");
    setShowMobileSearchOverlay(true);
    setAsideOpen(false);
  };

  const handleMobileAccountTab = () => {
    setMobileTab("account");
    setShowMobileSearchOverlay(false);
    setAsideOpen(false);
    navigate("/micuenta");
  };

  const handleMobileSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = mobileSearchValue.trim();
    setShowMobileSearchOverlay(false);
    setMobileTab("home");
    navigate("/");
    queueMobileSearch(nextQuery);
  };

  const isHomeTabActive = !showMobileSearchOverlay && mobileTab === "home";
  const isSearchTabActive = showMobileSearchOverlay;
  const isLibraryTabActive = !showMobileSearchOverlay && mobileTab === "library";
  const isAccountTabActive =
    !showMobileSearchOverlay &&
    (location.pathname.startsWith("/micuenta") || mobileTab === "account");

  return (
    <div className="main-layout-main-container">
      {showImpersonationBanner && (
        <div className="impersonation-banner" role="status" aria-live="polite">
          <p>Estás navegando como usuario (impersonación).</p>
          <button type="button" onClick={handleReturnToAdmin}>
            Volver a Admin
          </button>
        </div>
      )}
      {showAppChrome && (
        <Navbar
          setAsideOpen={setAsideOpen}
          menuButtonRef={menuButtonRef}
          hideMenuButton={false}
        />
      )}
      {showMobileTabBar && showMobileSearchOverlay && (
        <div className="mobile-search-overlay" role="dialog" aria-modal="true" aria-label="Buscar en biblioteca">
          <div
            className="mobile-search-overlay__backdrop"
            onClick={closeMobileSearchOverlay}
            aria-hidden
          />
          <div className="mobile-search-overlay__sheet">
            <div className="mobile-search-overlay__head">
              <h2>Buscar</h2>
              <button
                type="button"
                className="mobile-search-overlay__close"
                onClick={closeMobileSearchOverlay}
                aria-label="Cerrar búsqueda"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <form className="mobile-search-overlay__form" onSubmit={handleMobileSearchSubmit}>
              <input
                ref={mobileSearchInputRef}
                type="search"
                value={mobileSearchValue}
                autoFocus
                onChange={(event) => setMobileSearchValue(event.target.value)}
                className="mobile-search-overlay__input"
                placeholder="Busca por canción, artista o carpeta"
                aria-label="Buscar archivos"
              />
              <button type="submit" className="mobile-search-overlay__submit">
                Buscar
              </button>
            </form>
          </div>
        </div>
      )}
      <div className="content-container">
        {showAppChrome && (
          <AsideNavbar show={asideOpen} onHide={handleAsideHide} />
        )}
        {showDownload && currentUser !== null && <FileLoader />}
        {/* Guardrails visuales (altura mínima, tipografía consistente) deben aplicar en TODAS las rutas,
            incl. Auth/Planes/Instrucciones. Son mínimos y no pisan estilos específicos. */}
        <div className="content-container-inner content-area-app">
          <main id="main-content" className="main-layout-main" tabIndex={-1}>
            <div
              className={
                isFullWidth
                  ? "content-shell content-shell--full"
                  : "content-shell content-shell--app"
              }
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      {showMobileTabBar && (
        <nav className="mobile-tabbar" aria-label="Navegación principal móvil">
          <button
            type="button"
            className={`mobile-tabbar__tab ${isHomeTabActive ? "is-active" : ""}`}
            onClick={handleMobileHomeTab}
            aria-label="Inicio"
            aria-current={isHomeTabActive ? "page" : undefined}
          >
            <span className="mobile-tabbar__icon" aria-hidden>
              <House size={18} />
            </span>
            <span className="mobile-tabbar__label">Inicio</span>
          </button>
          <button
            type="button"
            className={`mobile-tabbar__tab ${isSearchTabActive ? "is-active" : ""}`}
            onClick={handleMobileSearchTab}
            aria-label="Buscar"
            aria-current={isSearchTabActive ? "page" : undefined}
          >
            <span className="mobile-tabbar__icon" aria-hidden>
              <Search size={18} />
            </span>
            <span className="mobile-tabbar__label">Buscar</span>
          </button>
          <button
            type="button"
            className={`mobile-tabbar__tab ${isLibraryTabActive ? "is-active" : ""}`}
            onClick={handleMobileLibraryTab}
            aria-label="Biblioteca"
            aria-current={isLibraryTabActive ? "page" : undefined}
          >
            <span className="mobile-tabbar__icon" aria-hidden>
              <Folder size={18} />
            </span>
            <span className="mobile-tabbar__label">Biblioteca</span>
          </button>
          <button
            type="button"
            className={`mobile-tabbar__tab ${isAccountTabActive ? "is-active" : ""}`}
            onClick={handleMobileAccountTab}
            aria-label="Cuenta"
            aria-current={isAccountTabActive ? "page" : undefined}
          >
            <span className="mobile-tabbar__icon" aria-hidden>
              <UserRound size={18} />
            </span>
            <span className="mobile-tabbar__label">Cuenta</span>
          </button>
        </nav>
      )}
    </div>
  );
}

export default MainLayout;
