import { useState } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { AppSettings } from "@/lib/settings";

interface OptionsPanelProps {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
}

export function OptionsPanel({ settings, onChange }: OptionsPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <Sparkles className="w-4 h-4" />
        <span>Enhance with AI</span>
        <span className="text-xs ml-1 text-muted-foreground">(optional)</span>
        <span className="ml-auto">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground pt-3">
            AI features improve conversions for images and audio. Leave blank to skip.
          </p>

          {/* LLM Section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Image & Audio Descriptions (OpenAI)
            </label>
            <input
              type="password"
              placeholder="OpenAI API Key (sk-...)"
              value={settings.llm_api_key}
              onChange={(e) => onChange({ llm_api_key: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              autoComplete="off"
            />
            <input
              type="text"
              placeholder="Model (default: gpt-4o)"
              value={settings.llm_model}
              onChange={(e) => onChange({ llm_model: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Azure Doc Intel */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Azure Document Intelligence
            </label>
            <input
              type="text"
              placeholder="Endpoint URL (https://...)"
              value={settings.docintel_endpoint}
              onChange={(e) => onChange({ docintel_endpoint: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Azure CU */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Azure Content Understanding
            </label>
            <input
              type="text"
              placeholder="Endpoint URL (https://...)"
              value={settings.cu_endpoint}
              onChange={(e) => onChange({ cu_endpoint: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Settings are saved locally on your machine.
          </p>
        </div>
      )}
    </div>
  );
}
