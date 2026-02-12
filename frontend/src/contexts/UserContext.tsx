import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { clearManyChatHandoff, getManyChatHandoffToken } from "../utils/manychatHandoff";

const AUTH_BROADCAST_CHANNEL = "bb-auth";
type AuthBroadcastMessage =
  | { type: "auth:request"; senderId: string }
  | { type: "auth:tokens"; senderId: string; token: string; refreshToken: string }
  | { type: "auth:logout"; senderId: string };

function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lowered = message.toLowerCase();
  return lowered.includes("failed to fetch") || lowered.includes("network");
}

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

  const broadcastSenderId = useMemo(
    () => `tab_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
    []
  );
  const authBroadcastRef = useRef<BroadcastChannel | null>(null);

  const broadcastAuthTokens = useCallback(
    (token: string, refreshToken: string) => {
      if (typeof window === "undefined") return;
      if (!authBroadcastRef.current) return;
      const message: AuthBroadcastMessage = {
        type: "auth:tokens",
        senderId: broadcastSenderId,
        token,
        refreshToken,
      };
      authBroadcastRef.current.postMessage(message);
    },
    [broadcastSenderId]
  );

  const broadcastLogout = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!authBroadcastRef.current) return;
    const message: AuthBroadcastMessage = { type: "auth:logout", senderId: broadcastSenderId };
    authBroadcastRef.current.postMessage(message);
  }, [broadcastSenderId]);

  const loginLocal = useCallback((token: string, refreshToken: string) => {
    setAuthTokens(token, refreshToken);
    setUserToken(token);
  }, []);

  function handleLogin(token: string, refreshToken: string) {
    loginLocal(token, refreshToken);
    // UX: si el usuario abre otra pestaña (ManyChat / links externos) mientras ya tiene sesion,
    // sincronizamos tokens para evitar que vea "Iniciar sesion" en superficies publicas.
    broadcastAuthTokens(token, refreshToken);
  }
  function resetCard() {
    setFileChange(true);
  }
  function closeFile() {
    setFileChange(false);
  }

  const logoutLocal = useCallback((redirectToHome: boolean = false) => {
    setCurrentUser(null);
    clearAuthTokens();
    clearAdminAccessBackup();
    setUserToken(null);

    if (redirectToHome && typeof window !== "undefined") {
      window.location.assign("/");
    }
  }, []);

  function handleLogout(redirectToHome: boolean = false) {
    logoutLocal(redirectToHome);
    broadcastLogout();
  }

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
      // Important: keep other tabs in sync when we refresh.
      loginLocal(token.token, token.refreshToken);
      broadcastAuthTokens(token.token, token.refreshToken);
      return "success" as const;
    }
    catch (error) {
      if (isNetworkError(error)) {
        return "network" as const;
      }
      logoutLocal(false);
      broadcastLogout();
      return "denied" as const;
    }
  }, [broadcastAuthTokens, broadcastLogout, loginLocal, logoutLocal]);

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
    if (typeof window === "undefined") return;
    if (!("BroadcastChannel" in window)) return;

    const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    authBroadcastRef.current = channel;

    const handler = (event: MessageEvent) => {
      const data = event.data as Partial<AuthBroadcastMessage> | null;
      if (!data || typeof data !== "object") return;
      if (data.senderId === broadcastSenderId) return;

      if (data.type === "auth:request") {
        const token = getAccessToken();
        const refreshToken = getRefreshToken();
        if (!token || !refreshToken) return;
        const response: AuthBroadcastMessage = {
          type: "auth:tokens",
          senderId: broadcastSenderId,
          token,
          refreshToken,
        };
        channel.postMessage(response);
        return;
      }

      if (data.type === "auth:tokens") {
        const token = typeof data.token === "string" ? data.token : "";
        const refreshToken = typeof data.refreshToken === "string" ? data.refreshToken : "";
        if (!token || !refreshToken) return;
        if (getAccessToken() === token) return;
        loginLocal(token, refreshToken);
        return;
      }

      if (data.type === "auth:logout") {
        if (!getAccessToken()) return;
        logoutLocal(false);
      }
    };

    channel.addEventListener("message", handler);

    return () => {
      channel.removeEventListener("message", handler);
      channel.close();
      authBroadcastRef.current = null;
    };
  }, [broadcastSenderId, loginLocal, logoutLocal]);

  useEffect(() => {
    // If there is no token in this tab, try to request it from another open tab of the same site.
    // This keeps sessions consistent across tabs while still being sessionStorage-scoped.
    if (typeof window === "undefined") return;
    if (!authBroadcastRef.current) return;
    if (getAccessToken()) return;
    authBroadcastRef.current.postMessage({ type: "auth:request", senderId: broadcastSenderId } as AuthBroadcastMessage);
  }, [broadcastSenderId, userToken]);

  useEffect(() => {
    if (userToken) {
      startUser();
    } else {
      setCurrentUser(null);
    }
  }, [userToken, startUser]);

  // If the user came from a ManyChat handoff link, claim it once they're authenticated.
  // This links the ManyChat contact to the web user (server-side) and then clears the local token.
  useEffect(() => {
    if (!userToken) return;
    const token = getManyChatHandoffToken();
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await trpc.auth.claimManyChatHandoff.mutate({ token });
        if (cancelled) return;
        // Clear the token on any successful roundtrip (ok or known failure).
        if (result && typeof result === "object" && "ok" in result) {
          clearManyChatHandoff();
        }
      } catch {
        // Keep the token; we can retry on the next auth refresh.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userToken]);

  // If the user is already logged in and opens a new handoff link in the same session, claim it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!userToken) return;

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ token?: string }>).detail;
      const token = `${detail?.token ?? ""}`.trim() || getManyChatHandoffToken();
      if (!token) return;

      void trpc.auth
        .claimManyChatHandoff
        .mutate({ token })
        .then((result: any) => {
          if (result && typeof result === "object" && "ok" in result) {
            clearManyChatHandoff();
          }
        })
        .catch(() => {
          // noop
        });
    };

    window.addEventListener("bb:manychat-handoff", handler as EventListener);
    return () => {
      window.removeEventListener("bb:manychat-handoff", handler as EventListener);
    };
  }, [userToken]);

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
