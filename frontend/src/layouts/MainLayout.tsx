import "./MainLayout.scss";
import AsideNavbar from "../components/AsideNavbar/AsideNavbar";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar/Navbar";
import { useUserContext } from "../contexts/UserContext";
import { useEffect, useRef, useState } from "react";
import { useDownloadContext } from "../contexts/DownloadContext";
import { FileLoader } from "../components/FileLoader/FileLoader";
import { applyRouteSeo } from "../utils/seo";

function MainLayout() {
  const { userToken, currentUser } = useUserContext();
  const { showDownload } = useDownloadContext();
  const location = useLocation();

  const [asideOpen, setAsideOpen] = useState<boolean>(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const handleAsideHide = () => {
    menuButtonRef.current?.focus();
    setAsideOpen(false);
  };

  useEffect(() => {
    setAsideOpen(false);
  }, [location]);

  useEffect(() => {
    applyRouteSeo(location.pathname);
  }, [location.pathname]);

  // Solo la landing pública (/) sin sesión usa estilo landing; el resto usa fondo app (slate)
  const isLanding = !userToken && location.pathname === "/";
  const useAppBackground = !isLanding;

  return (
    <div className={`main-layout-main-container ${useAppBackground ? "bg-slate-950" : ""}`}>
      {userToken && <Navbar setAsideOpen={setAsideOpen} menuButtonRef={menuButtonRef} />}
      <div className={`content-container landing-layout${isLanding ? " content-container--landing" : ""} ${useAppBackground ? "bg-gradient-to-br from-slate-950 to-slate-900" : ""}`}>
        {userToken && (
          <AsideNavbar show={asideOpen} onHide={handleAsideHide} />
        )}
        {showDownload && currentUser !== null && <FileLoader />}
        <div className={`content-container-inner ${useAppBackground ? "content-area-app min-h-screen w-full font-poppins text-slate-200 bg-transparent transition-colors duration-300" : ""}`}>
          <main className="flex-1 bg-slate-950 min-h-screen w-full min-w-0">
            <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default MainLayout;
