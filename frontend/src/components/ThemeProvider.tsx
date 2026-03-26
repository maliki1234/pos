"use client";

import React, { ReactNode, useEffect } from "react";
import { useThemeStore, applyTheme } from "@/lib/theme";

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { theme, getSystemTheme } = useThemeStore();

  useEffect(() => {
    // Apply theme on mount
    applyTheme(theme, getSystemTheme);

    // Listen for system theme changes
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        applyTheme(theme, getSystemTheme);
      };
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme, getSystemTheme]);

  return <>{children}</>;
};
