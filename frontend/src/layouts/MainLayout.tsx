import "./MainLayout.scss";
import AsideNavbar from "../components/AsideNavbar/AsideNavbar";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar/Navbar";
import { useUserContext } from "../contexts/UserContext";
import { useEffect, useState } from "react";
import { useDownloadContext } from "../contexts/DownloadContext";
import { FileLoader } from "../components/FileLoader/FileLoader";
import { applyRouteSeo } from "../utils/seo";

function MainLayout() {
  const { userToken, currentUser } = useUserContext();
  const { showDownload } = useDownloadContext();
  const location = useLocation();

  const [asideOpen, setAsideOpen] = useState<boolean>(false);

  useEffect(() => {
    setAsideOpen(false);
  }, [location]);

  useEffect(() => {
    applyRouteSeo(location.pathname);
  }, [location.pathname]);

  // Sin sesión = mismo layout que la landing (ancho completo, mismo estilo)
  const isLanding = !userToken;

  return (
    <div className="main-layout-main-container">
      {userToken && <Navbar setAsideOpen={setAsideOpen} />}
      <div className={`content-container landing-layout${isLanding ? " content-container--landing" : ""}`}>
        {userToken && (
          <AsideNavbar show={asideOpen} onHide={() => setAsideOpen(false)} />
        )}
        {showDownload && currentUser !== null && <FileLoader />}
        <div className={`content-container-inner ${isLanding ? "" : "content-area-app min-h-screen font-poppins text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950"}`}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default MainLayout;
