import "./MainLayout.scss";
import AsideNavbar from "../components/AsideNavbar/AsideNavbar";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar/Navbar";
import { useUserContext } from "../contexts/UserContext";

function MainLayout() {
  const { currentUser } = useUserContext();
  return (
    <div className="main-layout-main-container">
      {currentUser && <Navbar />}
      <div className="content-container">
        {currentUser && <AsideNavbar />}
        <Outlet />
      </div>
    </div>
  );
}

export default MainLayout;
