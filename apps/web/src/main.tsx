import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import ApplicationForm from "./pages/ApplicationForm";
import Responses from "./pages/Responses";

const router = createBrowserRouter([
  { path: "/", element: <ApplicationForm /> },
  { path: "/responses", element: <Responses /> },
  { path: "*", element: <ApplicationForm /> },
]);

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
