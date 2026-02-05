import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";

function Auth() {
  useEffect(() => {
    trackManyChatConversion(MC_EVENTS.VIEW_AUTH);
  }, []);
  return (
    <div className="min-h-screen w-full bg-bear-light-200 dark:bg-bear-dark-900 flex items-center justify-center p-4">
      <Outlet />
    </div>
  );
}

export default Auth;
