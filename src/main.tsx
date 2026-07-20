import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
);
