import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeMode = "light" | "dark" | "system" | "schedule";

const STORAGE_KEY = "bear-theme";

// Horario: 6:00–20:59 = light, 21:00–5:59 = dark (hora local)
function isScheduleLight(): boolean {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 21;
}

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveEffectiveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  if (mode === "schedule") return isScheduleLight() ? "light" : "dark";
  return getSystemPrefersDark() ? "dark" : "light";
}

interface ThemeContextValue {
  mode: ThemeMode;
  theme: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (stored && ["light", "dark", "system", "schedule"].includes(stored))
        return stored;
    } catch (_) {}
    return "light";
  });

  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">(() =>
    resolveEffectiveTheme(mode)
  );

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch (_) {}
  }, []);

  useEffect(() => {
    const apply = () => {
      const next = resolveEffectiveTheme(mode);
      setEffectiveTheme(next);
      document.documentElement.setAttribute("data-theme", next);
    };

    apply();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (mode === "system") apply();
    };
    media.addEventListener("change", onSystemChange);

    let scheduleInterval: ReturnType<typeof setInterval> | null = null;
    if (mode === "schedule") {
      scheduleInterval = setInterval(apply, 60 * 1000);
    }

    return () => {
      media.removeEventListener("change", onSystemChange);
      if (scheduleInterval) clearInterval(scheduleInterval);
    };
  }, [mode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, theme: effectiveTheme, setMode }),
    [mode, effectiveTheme, setMode]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
