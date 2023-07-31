import "./MainLayout.scss";
import AsideNavbar from "../components/AsideNavbar/AsideNavbar";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar/Navbar";
import { useUserContext } from "../contexts/UserContext";
import { useEffect, useState } from "react";

function MainLayout() {
  const { currentUser } = useUserContext();
  const location = useLocation();

  const [asideOpen, setAsideOpen] = useState<boolean>(false);

  useEffect(() => {
    setAsideOpen(false);
  }, [location]);

  return (
    <div className="main-layout-main-container">
      {currentUser && <Navbar setAsideOpen={setAsideOpen} />}
      <div className="content-container">
        {currentUser && (
          <AsideNavbar show={asideOpen} onHide={() => setAsideOpen(false)} />
        )}
        <Outlet />
      </div>
    </div>
  );
}

export default MainLayout;
