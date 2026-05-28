export interface HistoryItem {
  id: string;
  source: string;
  markdown: string;
  tokenCount: number;
  timestamp: number;
}

export interface AppSettings {
  defaultSaveDir: string;
  theme: "light" | "dark" | "system";
  llm_client_type: string;
  llm_api_key: string;
  llm_model: string;
  llm_prompt: string;
  docintel_endpoint: string;
  cu_endpoint: string;
  history: HistoryItem[];
}

const SETTINGS_KEY = "markitdown_desktop_settings";

const DEFAULTS: AppSettings = {
  defaultSaveDir: "",
  theme: "system",
  llm_client_type: "openai",
  llm_api_key: "",
  llm_model: "gpt-4o",
  llm_prompt: "",
  docintel_endpoint: "",
  cu_endpoint: "",
  history: [],
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function addHistoryItem(
  settings: AppSettings,
  item: Omit<HistoryItem, "id">
): AppSettings {
  const entry: HistoryItem = { ...item, id: crypto.randomUUID() };
  const history = [entry, ...settings.history].slice(0, 20);
  return { ...settings, history };
}
