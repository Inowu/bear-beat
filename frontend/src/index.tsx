import "./instrument";
import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import "./index.css";
import "./styles/index.scss";
import reportWebVitals from "./reportWebVitals";
import { initFacebookPixel } from "./utils/facebookPixel";
import { ErrorFallback } from "./components/ErrorFallback/ErrorFallback";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
} from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Home from "./pages/Home/Home";
import UserContextProvider from "./contexts/UserContext";
import AuthRoute from "./functions/AuthRoute";
import LandingOrAuthRoute from "./functions/LandingOrAuthRoute";
import HomeOrLanding from "./functions/HomeOrLanding";
import Auth from "./pages/Auth/Auth";
import NotAuthRoute from "./functions/NotAuthRoute";
import LoginForm from "./components/Auth/LoginForm/LoginForm";
import SignUpForm from "./components/Auth/SignUpForm/SignUpForm";
import ForgotPasswordForm from "./components/Auth/ForgotPasswordForm/ForgotPasswordForm";
import Instructions from "./pages/Instructions/Instructions";
import MyAccount from "./pages/MyAccount/MyAccount";
import Plans from "./pages/Plans/Plans";
import Checkout from "./pages/Checkout/Checkout";
import CheckoutSuccess from "./pages/Checkout/CheckoutSuccess";
import Admin from "./pages/Admin/Admin";
import ResetPassword from "./components/Auth/ResetPassword/ResetPassword";
import { PlanAdmin } from "./pages/Admin/PlanAdmin/PlanAdmin";
import { Storage } from "./pages/Admin/Storage/Storage";
import { Coupons } from "./pages/Admin/Coupons/Coupons";
import { Ordens } from "./pages/Admin/Ordens/Ordens";
import { HistoryCheckout } from "./pages/Admin/HistoryCheckout/HistoryCheckout";
import { DownloadHistory } from "./pages/Admin/DownloadsHistory/DownloadHistory";
import { BlockedEmailDomains } from "./pages/Admin/BlockedEmailDomains/BlockedEmailDomains";
import { BlockedPhoneNumbers } from "./pages/Admin/BlockedPhoneNumbers/BlockedPhoneNumbers";
import { CatalogStats } from "./pages/Admin/CatalogStats/CatalogStats";
import { PlanUpgrade } from "./pages/PlanUpgrade/PlanUpgrade";
import { SSEProvider } from "react-hooks-sse";
import DownloadContextProvider from "./contexts/DownloadContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Downloads from "./pages/Downloads/Downloads";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      {
        path: "",
        element: <LandingOrAuthRoute />,
        children: [
          { path: "", element: <HomeOrLanding /> },
          { path: "instrucciones", element: <Instructions /> },
          {
            path: "micuenta",
            element: (
              <AuthRoute>
                <MyAccount />
              </AuthRoute>
            ),
          },
          {
            path: "descargas",
            element: (
              <AuthRoute>
                <Downloads />
              </AuthRoute>
            ),
          },
          {
            path: "planes",
            element: (
              <AuthRoute>
                <Plans />
              </AuthRoute>
            ),
          },
          {
            path: "comprar",
            element: (
              <AuthRoute>
                <Checkout />
              </AuthRoute>
            ),
          },
          {
            path: "comprar/success",
            element: (
              <AuthRoute>
                <CheckoutSuccess />
              </AuthRoute>
            ),
          },
          {
            path: "actualizar-planes",
            element: (
              <AuthRoute>
                <PlanUpgrade />
              </AuthRoute>
            ),
          },
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
          { path: "almacenamiento", element: <Storage /> },
          { path: "catalogo", element: <CatalogStats /> },
          { path: "historial-descargas", element: <DownloadHistory /> },
          { path: "cupones", element: <Coupons /> },
          { path: "ordenes", element: <Ordens /> },
          { path: "historialCheckout", element: <HistoryCheckout /> },
          { path: "dominios-bloqueados", element: <BlockedEmailDomains /> },
          { path: "telefonos-bloqueados", element: <BlockedPhoneNumbers /> },
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
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
// 'https://thebearbeatapi.lat/trpc'
// 'https://kale67.world/trpc'
initFacebookPixel();

root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error }) => <ErrorFallback error={error instanceof Error ? error : undefined} />}
    >
    <ThemeProvider>
      <UserContextProvider>
        <DownloadContextProvider>
        <PayPalScriptProvider
          options={{
            clientId: process.env.REACT_APP_ENVIRONMENT === 'development'
              ? process.env.REACT_APP_PAYPAL_CLIENT_TEST_ID!
              : process.env.REACT_APP_PAYPAL_CLIENT_ID!,
          }}
        >
          <SSEProvider endpoint="https://thebearbeatapi.lat/sse">
            <RouterProvider router={router} />
          </SSEProvider>
        </PayPalScriptProvider>
        </DownloadContextProvider>
      </UserContextProvider>
    </ThemeProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
