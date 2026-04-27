import { useState, useEffect } from "react";

export function useAuth() {
  const [token, setToken] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("user_token");
    if (t) setToken(t);
  }, []);

  const handleSaveToken = (t: string) => {
    setToken(t);
    localStorage.setItem("user_token", t);
  };

  const user = token ? { uid: token.slice(0, 16) } : null;

  return { token, handleSaveToken, user };
}