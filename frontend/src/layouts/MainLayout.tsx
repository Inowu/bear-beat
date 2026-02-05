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

  const useAppBackground = !!userToken || location.pathname !== "/";
  const isFullWidth =
    location.pathname === "/" ||
    location.pathname.startsWith("/auth") ||
    location.pathname.startsWith("/instrucciones");

  return (
    <div className={`main-layout-main-container flex min-h-screen min-h-dvh w-full flex-col bg-bear-light-200 dark:bg-bear-dark-900 text-gray-700 dark:text-gray-300 font-poppins`}>
      {userToken && <Navbar setAsideOpen={setAsideOpen} menuButtonRef={menuButtonRef} />}
      <div className="flex flex-1 min-h-0 relative overflow-x-hidden border-t border-gray-200 dark:border-bear-dark-100 bg-gradient-to-br from-bear-light-200 to-gray-300 dark:from-bear-dark-900 dark:to-bear-dark-400 lg:flex-row lg:items-stretch">
        {userToken && <AsideNavbar show={asideOpen} onHide={handleAsideHide} />}
        {showDownload && currentUser !== null && <FileLoader />}
        <div
          className={
            useAppBackground
              ? "content-area-app flex min-h-0 flex-1 flex-col overflow-x-hidden min-h-screen w-full font-poppins text-gray-700 dark:text-gray-300 lg:min-w-0"
              : "flex min-h-0 flex-1 flex-col overflow-x-hidden w-full"
          }
          style={
            useAppBackground && !isFullWidth
              ? {
                  paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
                  paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
                  paddingBottom: "max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))",
                  paddingTop: "1rem",
                }
              : undefined
          }
        >
          <main className={`flex-1 w-full min-w-0 min-h-screen transition-all duration-300 ${useAppBackground ? "bg-bear-light-200 dark:bg-bear-dark-900" : ""} ${isFullWidth ? "p-0" : ""}`}>
            <div className={isFullWidth ? "w-full" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default MainLayout;
