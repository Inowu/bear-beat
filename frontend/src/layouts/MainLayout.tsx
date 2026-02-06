import AsideNavbar from "../components/AsideNavbar/AsideNavbar";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar/Navbar";
import { useUserContext } from "../contexts/UserContext";
import { useEffect, useRef, useState } from "react";
import { useDownloadContext } from "../contexts/DownloadContext";
import { FileLoader } from "../components/FileLoader/FileLoader";
import { applyRouteSeo } from "../utils/seo";
import "./MainLayout.scss";

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

  const isFullWidth =
    location.pathname === "/" ||
    location.pathname.startsWith("/auth") ||
    location.pathname.startsWith("/instrucciones");

  return (
    <div className="main-layout-main-container">
      {userToken && <Navbar setAsideOpen={setAsideOpen} menuButtonRef={menuButtonRef} />}
      <div className="content-container">
        {userToken && <AsideNavbar show={asideOpen} onHide={handleAsideHide} />}
        {showDownload && currentUser !== null && <FileLoader />}
        <div className={`content-container-inner ${!isFullWidth ? "content-area-app" : ""}`}>
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
