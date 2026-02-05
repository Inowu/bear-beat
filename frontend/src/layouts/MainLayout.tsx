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

  const isLanding = !userToken && location.pathname === "/";
  const useAppBackground = !isLanding;

  return (
    <div
      className={
        useAppBackground
          ? "flex min-h-screen min-h-dvh w-full flex-col bg-bear-dark-900 text-bear-light-200 font-poppins"
          : "flex min-h-screen min-h-dvh w-full flex-col text-bear-light-200 font-poppins"
      }
    >
      {userToken && <Navbar setAsideOpen={setAsideOpen} menuButtonRef={menuButtonRef} />}
      <div
        className={
          useAppBackground
            ? "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden border-t border-bear-dark-100 bg-gradient-to-br from-bear-dark-900 to-bear-dark-400 lg:flex-row lg:items-stretch lg:overflow-hidden"
            : "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
        }
      >
        {userToken && (
          <AsideNavbar show={asideOpen} onHide={handleAsideHide} />
        )}
        {showDownload && currentUser !== null && <FileLoader />}
        <div
          className={
            useAppBackground
              ? "content-area-app flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto min-h-screen w-full font-poppins text-bear-light-200 lg:min-w-0"
              : "flex min-h-0 flex-1 flex-col"
          }
          style={
            useAppBackground
              ? {
                  paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
                  paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
                  paddingBottom: "max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))",
                  paddingTop: "1rem",
                }
              : undefined
          }
        >
          <main className="min-h-screen w-full min-w-0 flex-1 bg-bear-dark-900">
            <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default MainLayout;
