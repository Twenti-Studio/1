import { createContext, useContext, useEffect, useState } from "react";

const SiteSettingsContext = createContext({});

export function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetch("/api/landing/settings")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => setSettings(data))
      .catch(() => setSettings({}));
  }, []);

  return (
    <SiteSettingsContext.Provider value={settings}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

/** Returns site settings object, or null while loading */
export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
