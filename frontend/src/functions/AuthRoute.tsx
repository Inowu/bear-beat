import { ReactNode, useEffect } from "react";
import { useUserContext } from "../contexts/UserContext";
import { useLocation, useNavigate } from "react-router-dom";

interface AuthRoutePropsI {
  children: ReactNode;
}

function AuthRoute({ children }: AuthRoutePropsI) {
  const { userToken } = useUserContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!userToken) {
      const returnUrl = location.pathname + location.search;
      navigate("/auth", { state: { from: returnUrl }, replace: true });
    }
  }, [userToken, navigate, location.pathname, location.search]);

  if (!userToken) {
    return null;
  }

  return <>{children}</>;
}

export default AuthRoute;
