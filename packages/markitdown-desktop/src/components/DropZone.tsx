import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Link } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onFiles: (paths: string[]) => void;
  onUrl: (url: string) => void;
  disabled?: boolean;
}

const SUPPORTED_EXTENSIONS = [
  "pdf", "docx", "pptx", "xlsx", "xls",
  "jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp",
  "mp3", "wav",
  "html", "htm", "csv", "json", "xml", "txt", "md",
  "ipynb", "msg", "zip", "epub",
];

// Comma-separated for the <input accept> fallback (browser dev mode)
const ACCEPT_ATTR = SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(",");

/** Open Tauri's native file-open dialog (returns real FS paths). */
async function openFileDialog(): Promise<string[] | null> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({
      multiple: true,
      filters: [
        { name: "All Supported Files", extensions: SUPPORTED_EXTENSIONS },
        { name: "PDF Files", extensions: ["pdf"] },
        { name: "Office Documents", extensions: ["docx", "pptx", "xlsx", "xls", "epub", "msg"] },
        { name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp"] },
        { name: "Web & Text", extensions: ["html", "htm", "csv", "json", "xml", "txt", "md"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (!result) return null;
    return Array.isArray(result) ? result : [result];
  } catch {
    return null; // not in Tauri — fall through to <input> fallback
  }
}

export function DropZone({ onFiles, onUrl, disabled }: DropZoneProps) {
  const [tab, setTab] = useState<"file" | "url">("file");
  const [dragging, setDragging] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep stable refs so the Tauri drag-drop listener can read current values
  // without being re-registered on every render.
  const onFilesRef = useRef(onFiles);
  const disabledRef = useRef(disabled);
  useEffect(() => { onFilesRef.current = onFiles; }, [onFiles]);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  // ------------------------------------------------------------------
  // Tauri drag-drop: onDragDropEvent gives real FS paths in WebView2.
  // The native DragEvent's file.path is NOT populated in Tauri v2.
  // ------------------------------------------------------------------
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        const win = getCurrentWebviewWindow();
        unlisten = await win.onDragDropEvent((event) => {
          const { type } = event.payload;
          if (type === "over") {
            if (!disabledRef.current) setDragging(true);
          } else if (type === "leave") {
            setDragging(false);
          } else if (type === "drop") {
            setDragging(false);
            if (!disabledRef.current) {
              const paths = (event.payload as { type: "drop"; paths: string[] }).paths;
              if (paths && paths.length > 0) onFilesRef.current(paths);
            }
          }
        });
      } catch {
        // Not running inside Tauri — native drag handlers (below) act as fallback
      }
    })();
    return () => unlisten?.();
  }, []);

  // Native drag handlers — visual feedback + fallback for plain-browser dev mode
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      // In Tauri the paths come via onDragDropEvent above.
      // This branch only runs in plain-browser dev mode where file.path may exist.
      const files = Array.from(e.dataTransfer.files);
      const paths = files
        .map((f) => (f as File & { path?: string }).path ?? "")
        .filter(Boolean);
      if (paths.length > 0) onFiles(paths);
    },
    [disabled, onFiles]
  );

  const handleBrowse = useCallback(async () => {
    // Tauri native dialog — shows PDF, Office, Images etc. filters correctly
    const paths = await openFileDialog();
    if (paths && paths.length > 0) {
      onFiles(paths);
      return;
    }
    // Fallback: HTML <input> in browser dev mode
    inputRef.current?.click();
  }, [onFiles]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      const paths = files
        .map((f) => (f as File & { path?: string }).path ?? "")
        .filter(Boolean);
      if (paths.length > 0) onFiles(paths);
      e.target.value = "";
    },
    [onFiles]
  );

  const handleUrlSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = urlValue.trim();
      if (trimmed) {
        onUrl(trimmed);
        setUrlValue("");
      }
    },
    [urlValue, onUrl]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        <button
          className={cn(
            "px-4 py-1.5 text-sm rounded-md transition-colors",
            tab === "file"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("file")}
        >
          File / Folder
        </button>
        <button
          className={cn(
            "px-4 py-1.5 text-sm rounded-md transition-colors",
            tab === "url"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("url")}
        >
          URL
        </button>
      </div>

      {tab === "file" ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowse}
          className={cn(
            "border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 py-14 px-8 cursor-pointer select-none transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50",
            disabled && "opacity-50 pointer-events-none"
          )}
        >
          <div className="p-4 rounded-full bg-primary/10">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-base font-medium text-foreground">
              Drop any file here
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse
            </p>
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            PDF, Word, PowerPoint, Excel, Images, Audio, HTML, CSV, ZIP and more
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>
      ) : (
        <form
          onSubmit={handleUrlSubmit}
          className="flex flex-col gap-3 border-2 border-dashed border-border rounded-xl p-8"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Link className="w-5 h-5" />
            <span className="text-sm font-medium">Paste a URL to convert</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Works with any webpage, YouTube videos, Wikipedia articles, RSS feeds
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://..."
              disabled={disabled}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={disabled || !urlValue.trim()}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              Convert
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
