"use client";

import { createContext, useContext } from "react";

export type UserRole = "admin" | "hr_editor" | "viewer";

export type AuthContextValue = {
  isConfigured: boolean;
  authenticated: boolean;
  role: UserRole | null;
  userEmail: string | null;
};

const AuthContext = createContext<AuthContextValue>({
  isConfigured: false,
  authenticated: true,
  role: "admin",
  userEmail: null,
});

export function AuthProvider({
  value,
  children,
}: {
  value: AuthContextValue;
  children: React.ReactNode;
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}

export function canEdit(role: UserRole | null) {
  return role === "admin" || role === "hr_editor";
}
