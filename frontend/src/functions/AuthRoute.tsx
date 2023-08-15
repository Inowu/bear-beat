import { ReactNode, useEffect } from "react";
import { useUserContext } from "../contexts/UserContext";
import { useNavigate } from "react-router-dom";

interface AuthRoutePropsI {
  children: ReactNode;
}

function AuthRoute({ children }: AuthRoutePropsI) {
  const { userToken } = useUserContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userToken) {
      navigate("/auth");
    }
  }, [userToken, navigate]);

  if (!userToken) {
    return <></>; // Avoid rendering children until currentUser is verified
  }

  return <>{children}</>;
}

export default AuthRoute;
