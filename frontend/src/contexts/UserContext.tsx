import { createContext, useContext, useEffect, useState } from "react";
import trpc from "../api";
import { IUser } from "../interfaces/User";

interface UserContextI {
  currentUser: IUser | null;
  userToken: string | null;
  handleLogin: (token: string) => void;
  handleLogout: () => void;
  resetCard: ()=> void;
  fileChange: boolean;
}

export const UserContext = createContext<UserContextI>({
  currentUser: null,
  userToken: "",
  handleLogin: () => {},
  handleLogout: () => {},
  resetCard: ()=> {},
  fileChange: false,
});

export function useUserContext() {
  return useContext(UserContext);
}

const UserContextProvider = (props: any) => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fileChange, setFileChange] = useState<boolean>(false);

  function handleLogin(token: string) {
    localStorage.setItem("token", token);
    setUserToken(token);
    // localStorage.setItem("user", "Javier Centeno");
  }
  function resetCard() {
    console.log('reset');
    setFileChange(true);
  }
  function handleLogout() {
    // setCurrentUser(null);
    // localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUserToken(null);
  }
  async function startUser () {
    try{
      const user: any = await trpc.auth.me.query( );
      setCurrentUser(user);
    }
    catch(error){
      console.log(error);
    }
  }
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token !== null) {
      setUserToken(token);
      startUser()
    }

    setLoading(false);
  }, []);

  const values = {
    userToken,
    currentUser,
    handleLogout,
    handleLogin,
    resetCard,
    fileChange,
  };

  if (loading) return <></>;

  return (
    <UserContext.Provider value={values}>{props.children}</UserContext.Provider>
  );
};

export default UserContextProvider;
