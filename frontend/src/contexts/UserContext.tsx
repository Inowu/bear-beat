import { createContext, useContext, useEffect, useState } from "react";
import trpc from "../api";

interface UserContextI {
  currentUser: { name: string } | null;
  userToken: string | null;
  handleLogin: (token: string) => void;
  handleLogout: () => void;
}

export const UserContext = createContext<UserContextI>({
  currentUser: null,
  userToken: "",
  handleLogin: () => {},
  handleLogout: () => {},
});

export function useUserContext() {
  return useContext(UserContext);
}

const UserContextProvider = (props: any) => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  function handleLogin(token: string) {
    localStorage.setItem("token", token);
    setUserToken(token);
    // localStorage.setItem("user", "Javier Centeno");
    setCurrentUser({ name: "Javier Centeno" });
  }

  function handleLogout() {
    // setCurrentUser(null);
    // localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUserToken(null);
  }
  async function startUser () {
    try{
      const user = await trpc.auth.me.query( );
      // setCurrentUser(user);
      // console.log(user);
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
  };

  if (loading) return <></>;

  return (
    <UserContext.Provider value={values}>{props.children}</UserContext.Provider>
  );
};

export default UserContextProvider;
