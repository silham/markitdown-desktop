import { useCallback, useEffect, useState } from "react";
import { DropZone } from "@/components/DropZone";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { OutputActions } from "@/components/OutputActions";
import { OptionsPanel } from "@/components/OptionsPanel";
import { HistorySidebar } from "@/components/HistorySidebar";
import { useConversion } from "@/hooks/useConversion";
import { useSettings } from "@/hooks/useSettings";
import { estimateTokens } from "@/lib/utils";
import { ping } from "@/lib/api";
import { HistoryItem } from "@/lib/settings";
import { Loader2, AlertCircle, History } from "lucide-react";
import { cn } from "@/lib/utils";

// Tauri APIs — imported lazily so the app can also run in a plain browser for dev
async function getTauriSidecarPort(): Promise<number | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const port = await invoke<number | null>("get_sidecar_port");
    return port;
  } catch {
    return null;
  }
}

async function listenForSidecarPort(cb: (port: number) => void): Promise<() => void> {
  try {
    const { listen } = await import("@tauri-apps/api/event");
    const unlisten = await listen<number>("sidecar-port", (event) => cb(event.payload));
    return unlisten;
  } catch {
    return () => {};
  }
}

export default function App() {
  const { settings, updateSettings, pushHistory } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidecarReady, setSidecarReady] = useState(false);
  const [sidecarError, setSidecarError] = useState(false);

  const conversionOptions = {
    llm_client_type: settings.llm_api_key ? settings.llm_client_type : undefined,
    llm_api_key: settings.llm_api_key || undefined,
    llm_model: settings.llm_model || undefined,
    llm_prompt: settings.llm_prompt || undefined,
    docintel_endpoint: settings.docintel_endpoint || undefined,
    cu_endpoint: settings.cu_endpoint || undefined,
  };

  const { status, result, error, convert, reset } = useConversion(conversionOptions);

  // Get port from Tauri, then poll for sidecar readiness
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Listen for the port event (fires when sidecar starts)
      const unlisten = await listenForSidecarPort((port) => {
        localStorage.setItem("sidecar_port", String(port));
      });

      // Also try the invoke in case the sidecar is already up
      const existingPort = await getTauriSidecarPort();
      if (existingPort) localStorage.setItem("sidecar_port", String(existingPort));

      // Poll until the sidecar responds to /ping
      let attempts = 0;
      const maxAttempts = 40;
      const interval = setInterval(async () => {
        if (cancelled) { clearInterval(interval); unlisten(); return; }
        const ok = await ping();
        if (ok) {
          setSidecarReady(true);
          clearInterval(interval);
          unlisten();
        } else if (++attempts >= maxAttempts) {
          setSidecarError(true);
          clearInterval(interval);
          unlisten();
        }
      }, 500);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const handleFiles = useCallback(
    async (paths: string[]) => {
      if (paths.length === 1) {
        const res = await convert({ path: paths[0] });
        if (res) {
          pushHistory({
            source: paths[0],
            markdown: res.markdown,
            tokenCount: estimateTokens(res.markdown),
            timestamp: Date.now(),
          });
        }
      }
    },
    [convert, pushHistory]
  );

  const handleUrl = useCallback(
    async (url: string) => {
      const res = await convert({ url });
      if (res) {
        pushHistory({
          source: url,
          markdown: res.markdown,
          tokenCount: estimateTokens(res.markdown),
          timestamp: Date.now(),
        });
      }
    },
    [convert, pushHistory]
  );

  const handleHistorySelect = useCallback((item: HistoryItem) => {
    // Re-show a history item without re-converting
    setSidebarOpen(false);
    // Inject into state by triggering a faux convert that just sets result
    // We do this via a local override pattern:
    window.__injectMarkdown?.(item.markdown, item.source);
  }, []);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* History sidebar */}
      <aside
        className={cn(
          "flex-shrink-0 border-r border-border bg-card transition-all duration-200 overflow-hidden",
          sidebarOpen ? "w-64" : "w-0"
        )}
      >
        <div className="w-64 h-full p-3 overflow-y-auto">
          <HistorySidebar
            history={settings.history}
            onSelect={handleHistorySelect}
          />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Titlebar */}
        <header
          className="flex items-center justify-between px-4 py-3 border-b border-border bg-card flex-shrink-0"
          data-tauri-drag-region
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
              title="Toggle history"
            >
              <History className="w-4 h-4" />
            </button>
            <span className="font-semibold text-sm">MarkItDown Desktop</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                sidecarReady
                  ? "bg-green-500"
                  : sidecarError
                  ? "bg-red-500"
                  : "bg-yellow-400 animate-pulse"
              )}
            />
            <span className="text-xs text-muted-foreground">
              {sidecarReady
                ? "Ready"
                : sidecarError
                ? "Backend error"
                : "Starting…"}
            </span>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4 min-h-0">
          {status === "idle" || status === "loading" ? (
            <>
              <DropZone
                onFiles={handleFiles}
                onUrl={handleUrl}
                disabled={!sidecarReady || status === "loading"}
              />
              {status === "loading" && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Converting…</span>
                </div>
              )}
              <OptionsPanel settings={settings} onChange={updateSettings} />
            </>
          ) : status === "error" ? (
            <div className="flex flex-col items-center justify-center gap-3 flex-1">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-6 h-6" />
                <span className="font-medium">Conversion failed</span>
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-md">{error}</p>
              <button
                onClick={reset}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Try again
              </button>
            </div>
          ) : (
            // success
            <>
              <div className="flex-shrink-0">
                <OutputActions
                  markdown={result?.markdown ?? ""}
                  source={result?.source}
                  onReset={reset}
                />
              </div>
              <div className="flex-1 min-h-0">
                <MarkdownPreview
                  markdown={result?.markdown ?? ""}
                  source={result?.source}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sidecar not ready overlay */}
      {sidecarError && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="font-semibold">Could not start the conversion engine</p>
            <p className="text-sm text-muted-foreground">
              Please restart the app. If the problem persists, check that the app was installed correctly.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Escape hatch for history injection (avoids prop drilling)
declare global {
  interface Window {
    __injectMarkdown?: (markdown: string, source: string) => void;
  }
}
