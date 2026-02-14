import { ReactNode, useEffect } from "react";
import { useUserContext } from "../contexts/UserContext";
import { useLocation, useNavigate } from "react-router-dom";
import { getAccessToken } from "../utils/authStorage";
import { Spinner } from "../components/Spinner/Spinner";
import { writeAuthReturnUrl } from "../utils/authReturnUrl";

interface AuthRoutePropsI {
  children: ReactNode;
}

function AuthRoute({ children }: AuthRoutePropsI) {
  const { userToken } = useUserContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!userToken) {
      // If a token exists in storage, the session is likely hydrating; avoid redirecting prematurely.
      if (getAccessToken()) return;
      const returnUrl = location.pathname + location.search;
      // Persist returnUrl so refresh/back-forward on /auth doesn't lose the checkout context.
      writeAuthReturnUrl(returnUrl);
      const isCheckoutStart =
        returnUrl.startsWith("/comprar") && !returnUrl.startsWith("/comprar/success");
      // Conversion-first: if the user is trying to buy/activate, default to signup (they can still switch to login).
      navigate(isCheckoutStart ? "/auth/registro" : "/auth", { state: { from: returnUrl }, replace: true });
    }
  }, [userToken, navigate, location.pathname, location.search]);

  if (!userToken) {
    const isHydrating = Boolean(getAccessToken());
    return (
      <div className="global-loader" aria-busy="true" aria-live="polite">
        <div className="app-state-panel is-loading" role="status">
          <span className="app-state-icon" aria-hidden>
            <Spinner size={2.8} width={0.25} color="var(--app-accent)" />
          </span>
          <h2 className="app-state-title">{isHydrating ? "Cargando tu sesión" : "Redirigiendo"}</h2>
          <p className="app-state-copy">
            {isHydrating ? "Un momento…" : "Abriendo inicio de sesión…"}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default AuthRoute;
