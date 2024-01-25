import { createContext, useContext, useEffect, useState } from "react";
import trpc from "../api";
import { IPaymentMethod, IUser } from "../interfaces/User";

interface UserContextI {
  currentUser: IUser | null;
  userToken: string | null;
  handleLogin: (token: string, refreshtoken: string) => void;
  handleLogout: () => void;
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
    localStorage.setItem("token", token);
    localStorage.setItem("refreshToken", refreshToken);
    setUserToken(token);
  }
  function resetCard() {
    setFileChange(true);
  }
  function closeFile() {
    setFileChange(false);
  }
  function handleLogout() {
    setCurrentUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    setUserToken(null);
  }
  const getPaymentMethods = async () => {
    setCardLoad(true);
    try {
      const cards: any = await trpc.subscriptions.listStripeCards.query();
      setPaymentMethods(cards.data);
      setCardLoad(false);
    }
    catch (error) {
      console.log(error);
    }
    setCardLoad(false);
  }
  async function startUser() {
    try {
      const user: any = await trpc.auth.me.query();
      setCurrentUser(user);
    }
    catch (error) {
      console.log('Trying refresh.....');
      startUserRefresh();
    }
  }
  async function startUserRefresh() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken !== null){
      try {
        const token = await trpc.auth.refresh.query({refreshToken: refreshToken });
        console.log('Login refresh succeed!');
        handleLogin(token.token, token.refreshToken);
      }
      catch (error) {
        console.log('Login refresh denied');
        handleLogout();
      }
    }
  }
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token !== null) {
      setUserToken(token);
      startUser()
    }
    setLoading(false);
  }, [userToken]);

  useEffect(() => {
    if (currentUser === null) {
      setPaymentMethods([])
    } else {
      getPaymentMethods();
    }
  }, [currentUser])
  useEffect(() => {
    const fetchData = async () => {
      try {
        startUserRefresh();
      } catch (error) {
        console.error('Error during API call:', error);
      }
    };
    fetchData();
    const intervalId = setInterval(fetchData, 1000 * 60 * 10);
    return () => clearInterval(intervalId);
  }, []);

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
