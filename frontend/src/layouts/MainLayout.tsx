import "./MainLayout.scss";
import AsideNavbar from "../components/AsideNavbar/AsideNavbar";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar/Navbar";
import { useUserContext } from "../contexts/UserContext";
import { useEffect, useState } from "react";
import { useDownloadContext } from "../contexts/DownloadContext";
import { FileLoader } from "../components/FileLoader/FileLoader";

function MainLayout() {
  const { userToken, currentUser } = useUserContext();
  const { showDownload } = useDownloadContext();
  const location = useLocation();

  const [asideOpen, setAsideOpen] = useState<boolean>(false);

  useEffect(() => {
    setAsideOpen(false);
  }, [location]);

  return (
    <div className="main-layout-main-container">
      {userToken && <Navbar setAsideOpen={setAsideOpen} />}
      <div className="content-container landing-layout">
        {userToken && (
          <AsideNavbar show={asideOpen} onHide={() => setAsideOpen(false)} />
        )}
        {showDownload && currentUser !== null && <FileLoader />}
        <Outlet />
      </div>
    </div>
  );
}

export default MainLayout;
