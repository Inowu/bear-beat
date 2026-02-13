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
      const isCheckoutStart =
        returnUrl.startsWith("/comprar") && !returnUrl.startsWith("/comprar/success");
      // Conversion-first: if the user is trying to buy/activate, default to signup (they can still switch to login).
      navigate(isCheckoutStart ? "/auth/registro" : "/auth", { state: { from: returnUrl }, replace: true });
    }
  }, [userToken, navigate, location.pathname, location.search]);

  if (!userToken) {
    return null;
  }

  return <>{children}</>;
}

export default AuthRoute;
