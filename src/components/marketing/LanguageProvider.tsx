"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import en from "@/src/locales/en.json";
import es from "@/src/locales/es.json";

type Lang = "en" | "es";
type Translations = typeof en;

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

function lookup(obj: unknown, keys: string[]): string {
  if (keys.length === 0 || typeof obj !== "object" || obj === null) {
    return typeof obj === "string" ? obj : keys.join(".");
  }
  return lookup((obj as Record<string, unknown>)[keys[0]], keys.slice(1));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("sr_lang") as Lang | null;
      if (stored === "en" || stored === "es") {
        setLangState(stored);
      } else if (navigator.language.toLowerCase().startsWith("es")) {
        setLangState("es");
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    try {
      localStorage.setItem("sr_lang", l);
    } catch {
      // ignore
    }
  }

  function t(key: string): string {
    const dict: Translations = lang === "es" ? es : en;
    const result = lookup(dict, key.split("."));
    return result;
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LangContext);
}
