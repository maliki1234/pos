import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  getSystemTheme: () => "light" | "dark";
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "system",
      setTheme: (theme: Theme) => {
        set({ theme });
        applyTheme(theme, get().getSystemTheme);
      },
      getSystemTheme: () => {
        if (typeof window === "undefined") return "light";
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      },
    }),
    {
      name: "theme-storage",
    }
  )
);

export function applyTheme(
  theme: Theme,
  getSystemTheme: () => "light" | "dark"
) {
  if (typeof document === "undefined") return;

  const html = document.documentElement;
  const effectiveTheme = theme === "system" ? getSystemTheme() : theme;

  if (effectiveTheme === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
}
