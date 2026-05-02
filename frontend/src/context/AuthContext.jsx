import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkCurrentUser = async () => {
      try {
        const { data } = await api.get("/auth/me");

        // Only save user if backend returns a proper role
        if (data && data.role) {
          setUser(data);
        } else {
          setUser(false);
          localStorage.removeItem("taskflow_token");
        }
      } catch (error) {
        setUser(false);
        localStorage.removeItem("taskflow_token");
      } finally {
        setLoading(false);
      }
    };

    checkCurrentUser();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });

    if (data?.token) {
      localStorage.setItem("taskflow_token", data.token);
    }

    if (data?.user && data.user.role) {
      setUser(data.user);
      return data.user;
    }

    throw new Error("Invalid login response");
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      // Ignore logout backend errors
    }

    localStorage.removeItem("taskflow_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
