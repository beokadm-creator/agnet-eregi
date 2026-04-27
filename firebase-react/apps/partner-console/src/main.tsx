import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./i18n"; // EP-15 i18n 초기화 로드 추가

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element #root was not found.");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
