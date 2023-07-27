import { ReactNode, useEffect } from "react";
import { useUserContext } from "../contexts/UserContext";
import { useNavigate } from "react-router-dom";

interface AuthRoutePropsI {
  children: ReactNode;
}

function AuthRoute({ children }: AuthRoutePropsI) {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  useEffect(() => {
    if (!currentUser) {
      navigate("/auth");
    }
  }, [currentUser]);

  if (!currentUser) {
    return <></>; // Avoid rendering children until currentUser is verified
  }
  return <>{children}</>;
}

export default AuthRoute;
