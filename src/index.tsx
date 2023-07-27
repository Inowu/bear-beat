import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.scss";
import reportWebVitals from "./reportWebVitals";
import { Outlet, RouterProvider, createBrowserRouter } from "react-router-dom";
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
        element: (
          <AuthRoute>
            <Outlet />
          </AuthRoute>
        ),
        children: [{ path: "", element: <Home /> }],
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
        ],
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);
root.render(
  <React.StrictMode>
    <UserContextProvider>
      <RouterProvider router={router} />
    </UserContextProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
