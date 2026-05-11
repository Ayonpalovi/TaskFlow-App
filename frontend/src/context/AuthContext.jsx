import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

function clearStoredSession() {
  try {
    localStorage.removeItem("taskflow_token");
  } catch {
    // Ignore storage restrictions.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkCurrentUser = async () => {
      try {
        const { data } = await api.get("/auth/me");

        if (data?.status === "deactivated") {
          setUser(false);
          clearStoredSession();
          try {
            sessionStorage.setItem("motionholic_auth_notice", "Your Motionholic OS account has been deactivated. Please contact the Motionholic team if you think this is a mistake.");
          } catch {
            // ignore
          }
          return;
        }

        // Only save user if backend returns a proper role
        if (data && data.role) {
          setUser(data);
        } else {
          setUser(false);
          clearStoredSession();
        }
      } catch (error) {
        setUser(false);
        clearStoredSession();
      } finally {
        setLoading(false);
      }
    };

    checkCurrentUser();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });

    if (data?.user?.status === "deactivated") {
      clearStoredSession();
      throw new Error("Your Motionholic OS account has been deactivated. Please contact the Motionholic team if you think this is a mistake.");
    }

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

    clearStoredSession();
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
