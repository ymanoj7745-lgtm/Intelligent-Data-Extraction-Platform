import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("ch_token");
    if (!token) { setReady(true); return; }
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem("ch_token"))
      .finally(() => setReady(true));
  }, []);

  async function login(email, password) {
    const r = await api.post("/auth/login", { email, password });
    localStorage.setItem("ch_token", r.data.access_token);
    setUser(r.data.user);
    return r.data.user;
  }

  function logout() {
    localStorage.removeItem("ch_token");
    setUser(null);
    window.location.href = "/login";
  }

  return (
    <AuthCtx.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
