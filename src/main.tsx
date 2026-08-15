import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "./App";
import ErrorBoundary from "./ErrorBoundary";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  </StrictMode>,
);
