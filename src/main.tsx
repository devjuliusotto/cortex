import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router";
import { AppShell } from "@/layouts/AppShell";
import "@xterm/xterm/css/xterm.css";
import "./styles.css";

const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
  },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
