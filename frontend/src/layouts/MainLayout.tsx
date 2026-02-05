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

  const isFullWidth =
    location.pathname === "/" ||
    location.pathname.startsWith("/auth") ||
    location.pathname.startsWith("/instrucciones");

  return (
    <div className="main-layout-main-container flex min-h-screen min-h-dvh w-full flex-col bg-bg-main text-text-main font-poppins">
      {userToken && <Navbar setAsideOpen={setAsideOpen} menuButtonRef={menuButtonRef} />}
      <div className="content-container flex flex-1 min-h-0 relative overflow-x-hidden border-t border-border bg-bg-main lg:flex-row lg:items-stretch">
        {userToken && <AsideNavbar show={asideOpen} onHide={handleAsideHide} />}
        {showDownload && currentUser !== null && <FileLoader />}
        <div className={`content-container-inner flex min-h-0 flex-1 flex-col overflow-x-hidden w-full lg:min-w-0 ${!isFullWidth ? "content-area-app" : ""}`}>
          <main className="flex-1 w-full min-w-0 min-h-0 flex flex-col">
            <div
              className={
                isFullWidth
                  ? "w-full p-0 m-0"
                  : "w-full max-w-7xl mx-auto px-4 py-8"
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
