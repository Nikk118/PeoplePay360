'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  employee_id?: string;
  employee_name?: string;
  is_active: boolean;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem("pp360_token");
      if (token) {
        try {
          const userData = await apiRequest<User>("/auth/me");
          setUser(userData);
          localStorage.setItem("pp360_user", JSON.stringify(userData));
        } catch (err) {
          localStorage.removeItem("pp360_token");
          localStorage.removeItem("pp360_user");
        }
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem("pp360_token", data.access_token);
    const userData: User = {
      id: data.user_id,
      email: data.email,
      employee_id: data.employee_id,
      is_active: true,
      roles: data.roles,
    };
    setUser(userData);
    localStorage.setItem("pp360_user", JSON.stringify(userData));
  };

  const logout = () => {
    localStorage.removeItem("pp360_token");
    localStorage.removeItem("pp360_user");
    setUser(null);
    window.location.href = "/login";
  };

  const hasRole = (role: string | string[]) => {
    if (!user) return false;
    if (user.roles.includes("admin")) return true;
    if (Array.isArray(role)) {
      return role.some(r => user.roles.includes(r));
    }
    return user.roles.includes(role);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
