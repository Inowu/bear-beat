import AsideNavbar from "../components/AsideNavbar/AsideNavbar";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import Navbar from "../components/Navbar/Navbar";
import { useUserContext } from "../contexts/UserContext";
import { useEffect, useRef, useState } from "react";
import { useDownloadContext } from "../contexts/DownloadContext";
import { FileLoader } from "../components/FileLoader/FileLoader";
import { applyRouteSeo } from "../utils/seo";
import { GROWTH_METRICS, trackGrowthMetric } from "../utils/growthMetrics";
import { hotjarStateChange } from "../utils/hotjar";
import "./MainLayout.scss";

function MainLayout() {
  const { userToken, currentUser } = useUserContext();
  const { showDownload } = useDownloadContext();
  const location = useLocation();
  const navigationType = useNavigationType();

  const [asideOpen, setAsideOpen] = useState<boolean>(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const trackedPathRef = useRef<string>("");

  const handleAsideHide = () => {
    menuButtonRef.current?.focus();
    setAsideOpen(false);
  };

  useEffect(() => {
    setAsideOpen(false);
  }, [location]);

  useEffect(() => {
    // React Router preserva scroll por defecto: si navegas desde el footer de una
    // pagina larga a una corta puedes "caer" en un offset vacío (se ve negro).
    // Solo forzamos scroll-to-top en navegaciones normales; en back/forward (POP)
    // dejamos que el navegador restaure el scroll.
    if (typeof window === "undefined") return;
    if (navigationType === "POP") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search, navigationType]);

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

    trackGrowthMetric(GROWTH_METRICS.PAGE_VIEW, {
      pagePath: location.pathname,
      pageQuery: location.search,
      section,
    });

    // Hotjar SPA state change (conversion surfaces only, see utils/hotjar.ts).
    hotjarStateChange(currentKey);
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

  return (
    <div className="main-layout-main-container">
      {showAppChrome && (
        <Navbar setAsideOpen={setAsideOpen} menuButtonRef={menuButtonRef} />
      )}
      <div className="content-container">
        {showAppChrome && (
          <AsideNavbar show={asideOpen} onHide={handleAsideHide} />
        )}
        {showDownload && currentUser !== null && <FileLoader />}
        {/* Guardrails visuales (altura mínima, tipografía consistente) deben aplicar en TODAS las rutas,
            incl. Auth/Planes/Instrucciones. Son mínimos y no pisan estilos específicos. */}
        <div className="content-container-inner content-area-app">
          <main className="main-layout-main">
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
    </div>
  );
}

export default MainLayout;
