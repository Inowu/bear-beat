import { ReactNode, useEffect } from "react";
import { useUserContext } from "../contexts/UserContext";
import { useNavigate } from "react-router-dom";

interface NotAuthRoutePropsI {
  children: ReactNode;
}

function NotAuthRoute({ children }: NotAuthRoutePropsI) {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  useEffect(() => {
    if (currentUser) {
      navigate("/");
    }
  }, [currentUser]);

  if (currentUser) {
    return <></>; // Avoid rendering children until currentUser is verified
  }
  return <>{children}</>;
}

export default NotAuthRoute;
