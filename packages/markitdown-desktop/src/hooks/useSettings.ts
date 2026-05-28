import { useState, useCallback } from "react";
import { loadSettings, saveSettings, addHistoryItem, AppSettings, HistoryItem } from "@/lib/settings";

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(loadSettings);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const pushHistory = useCallback((item: Omit<HistoryItem, "id">) => {
    setSettingsState((prev) => {
      const next = addHistoryItem(prev, item);
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, updateSettings, pushHistory };
}
