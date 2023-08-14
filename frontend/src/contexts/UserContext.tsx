import { createContext, useContext, useEffect, useState } from "react";

interface UserContextI {
  currentUser: { name: string } | null;
  userToken: string;
  handleLogin: () => void;
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
  const [userToken, setUserToken] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  function handleLogin() {
    localStorage.setItem("user", "Javier Centeno");
    setCurrentUser({ name: "Javier Centeno" });
  }

  function handleLogout() {
    setCurrentUser(null);
    localStorage.removeItem("user");
  }

  useEffect(() => {
    const userName = localStorage.getItem("user");
    console.log(userName);
    if (userName !== null) {
      setCurrentUser({ name: userName });
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
