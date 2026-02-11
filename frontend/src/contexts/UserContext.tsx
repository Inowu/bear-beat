import { createContext, useCallback, useContext, useEffect, useState } from "react";
import trpc from "../api";
import * as Sentry from "@sentry/react";
import { IPaymentMethod, IUser } from "../interfaces/User";
import {
  clearAdminAccessBackup,
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from "../utils/authStorage";

interface UserContextI {
  currentUser: IUser | null;
  userToken: string | null;
  handleLogin: (token: string, refreshtoken: string) => void;
  handleLogout: (redirectToHome?: boolean) => void;
  resetCard: () => void;
  fileChange: boolean;
  closeFile: () => void;
  startUser: () => void;
  paymentMethods: IPaymentMethod[];
  cardLoad: boolean;
  getPaymentMethods: () => void;
}

export const UserContext = createContext<UserContextI>({
  currentUser: null,
  userToken: "",
  handleLogin: () => { },
  handleLogout: () => { },
  resetCard: () => { },
  fileChange: false,
  closeFile: () => { },
  startUser: () => { },
  paymentMethods: [],
  cardLoad: false,
  getPaymentMethods: () => { },
});

export function useUserContext() {
  return useContext(UserContext);
}

const UserContextProvider = (props: any) => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fileChange, setFileChange] = useState<boolean>(false);
  const [paymentMethods, setPaymentMethods] = useState<IPaymentMethod[]>([]);
  const [cardLoad, setCardLoad] = useState<boolean>(false);

  function handleLogin(token: string, refreshToken: string) {
    setAuthTokens(token, refreshToken);
    setUserToken(token);
  }
  function resetCard() {
    setFileChange(true);
  }
  function closeFile() {
    setFileChange(false);
  }
  function handleLogout(redirectToHome: boolean = false) {
    setCurrentUser(null);
    clearAuthTokens();
    clearAdminAccessBackup();
    setUserToken(null);

    if (redirectToHome && typeof window !== "undefined") {
      window.location.assign("/");
    }
  }
  const isNetworkError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("network");
  };
  const getPaymentMethods = async () => {
    setCardLoad(true);
    try {
      const cards: any = await trpc.subscriptions.listStripeCards.query();
      setPaymentMethods(cards.data);
    }
    catch {
      setPaymentMethods([]);
    }
    setCardLoad(false);
  }
  const startUserRefresh = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken === null) return "none" as const;
    try {
      const token = await trpc.auth.refresh.query({ refreshToken });
      handleLogin(token.token, token.refreshToken);
      return "success" as const;
    }
    catch (error) {
      if (isNetworkError(error)) {
        return "network" as const;
      }
      handleLogout();
      return "denied" as const;
    }
  }, []);

  const startUser = useCallback(async () => {
    try {
      const user: any = await trpc.auth.me.query();
      setCurrentUser(user);
    }
    catch (error) {
      const refreshResult = await startUserRefresh();
      if (refreshResult === "success") {
        try {
          const refreshedUser: any = await trpc.auth.me.query();
          setCurrentUser(refreshedUser);
        } catch (retryError) {
          if (!isNetworkError(retryError)) {
            handleLogout();
          }
        }
      }
      if (refreshResult === "none") {
        handleLogout();
      }
    }
  }, [startUserRefresh]);
  useEffect(() => {
    const token = getAccessToken();
    if (token !== null) {
      setUserToken(token);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userToken) {
      startUser();
    } else {
      setCurrentUser(null);
    }
  }, [userToken, startUser]);

  useEffect(() => {
    if (currentUser === null) {
      setPaymentMethods([])
    } else {
      getPaymentMethods();
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) {
      Sentry.setUser(null);
      return;
    }

    Sentry.setUser({
      id: String(currentUser.id),
    });
    Sentry.setTag("user_role", currentUser.role);
    Sentry.setTag("user_verified", String(Boolean(currentUser.verified)));
  }, [currentUser]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await startUserRefresh();
      } catch {
        // noop
      }
    };
    fetchData();
    const intervalId = setInterval(fetchData, 1000 * 60 * 10);
    return () => clearInterval(intervalId);
  }, [startUserRefresh]);

  const values = {
    userToken,
    currentUser,
    handleLogout,
    handleLogin,
    resetCard,
    fileChange,
    closeFile,
    startUser,
    paymentMethods,
    cardLoad,
    getPaymentMethods,

  };

  if (loading) return <></>;

  return (
    <UserContext.Provider value={values}>{props.children}</UserContext.Provider>
  );
};

export default UserContextProvider;
