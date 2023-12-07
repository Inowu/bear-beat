import React from "react";
import ReactDOM from "react-dom/client";
import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import "./styles/index.scss";
import reportWebVitals from "./reportWebVitals";
import { Navigate, Outlet, RouterProvider, createBrowserRouter } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Home from "./pages/Home/Home";
import UserContextProvider from "./contexts/UserContext";
import AuthRoute from "./functions/AuthRoute";
import Auth from "./pages/Auth/Auth";
import NotAuthRoute from "./functions/NotAuthRoute";
import NotFound from "./pages/NotFound/NotFound";
import LoginForm from "./components/Auth/LoginForm/LoginForm";
import SignUpForm from "./components/Auth/SignUpForm/SignUpForm";
import ForgotPasswordForm from "./components/Auth/ForgotPasswordForm/ForgotPasswordForm";
import Instructions from "./pages/Instructions/Instructions";
import MyAccount from "./pages/MyAccount/MyAccount";
import Plans from "./pages/Plans/Plans";
import Checkout from "./pages/Checkout/Checkout";
import Admin from "./pages/Admin/Admin";
import ResetPassword from "./components/Auth/ResetPassword/ResetPassword";
import { PlanAdmin } from "./pages/PlanAdmin/PlanAdmin";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      {
        path: "",
        element: (
          <AuthRoute>
            <Outlet />
          </AuthRoute>
        ),
        children: [
          { path: "", element: <Home /> },
          { path: "instrucciones", element: <Instructions /> },
          { path: "micuenta", element: <MyAccount /> },
          { path: "planes", element: <Plans /> },
          { path: "comprar", element: <Checkout /> },
        ],
      },
      {
        path: "admin",
        element: (
          <AuthRoute>
            <Outlet />
          </AuthRoute>
        ),
        children: [
          { path: "", element: <Navigate replace to="usuarios" /> },
          { path: "usuarios", element: <Admin /> },
          { path: "planesAdmin", element: <PlanAdmin /> },
        ],
      },
      {
        path: "auth",
        element: (
          <NotAuthRoute>
            <Auth />
          </NotAuthRoute>
        ),
        children: [
          { path: "", element: <LoginForm /> },
          { path: "registro", element: <SignUpForm /> },
          { path: "recuperar", element: <ForgotPasswordForm /> },
          { path: "reset-password", element: <ResetPassword /> },
        ],
      },
      {
        path: "*",
        element: <Navigate to="/" replace />
      },
    ],
  },
]);
root.render(
  <React.StrictMode>
    <UserContextProvider>
      <PayPalScriptProvider
        options={{
          clientId:
            "AYuKvAI09TE9bk9k1TuzodZ2zWQFpWEZesT65IkT4WOws9wq-yfeHLj57kEBH6YR_8NgBUlLShj2HOSr",
          intent: "subscription",
          vault: true,
        }}
      >
        <RouterProvider router={router} />
      </PayPalScriptProvider>
    </UserContextProvider>
  </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
