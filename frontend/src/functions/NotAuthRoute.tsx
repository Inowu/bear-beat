import { ReactNode, useEffect, useMemo } from "react";
import { useUserContext } from "../contexts/UserContext";
import { useLocation, useNavigate } from "react-router-dom";

interface NotAuthRoutePropsI {
  children: ReactNode;
}

function NotAuthRoute({ children }: NotAuthRoutePropsI) {
  const { userToken } = useUserContext();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = useMemo(() => {
    const from = (location.state as { from?: unknown } | null)?.from;
    const target = typeof from === "string" && from.startsWith("/") ? from : "/";
    // Never redirect back into /auth (avoid loops).
    return target.startsWith("/auth") ? "/" : target;
  }, [location.state]);

  useEffect(() => {
    if (userToken) {
      navigate(redirectTo, { replace: true });
    }
  }, [userToken, navigate, redirectTo]);

  if (userToken) {
    return <></>; // Avoid rendering children until currentUser is verified
  }
  return <>{children}</>;
}

export default NotAuthRoute;
