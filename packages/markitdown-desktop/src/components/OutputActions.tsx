import { useCallback } from "react";
import { Copy, Save, RotateCcw } from "lucide-react";

interface OutputActionsProps {
  markdown: string;
  source?: string;
  onReset: () => void;
}

export function OutputActions({ markdown, source, onReset }: OutputActionsProps) {
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(markdown);
  }, [markdown]);

  const handleSave = useCallback(async () => {
    // Use the browser download API; Tauri's file system plugin used in App.tsx for advanced save
    const filename =
      (source ? source.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") : undefined) ??
      "output";
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [markdown, source]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        title="Copy markdown to clipboard"
      >
        <Copy className="w-4 h-4" />
        Copy
      </button>
      <button
        onClick={handleSave}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors"
        title="Save as .md file"
      >
        <Save className="w-4 h-4" />
        Save .md
      </button>
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors text-muted-foreground"
        title="Convert another file"
      >
        <RotateCcw className="w-4 h-4" />
        New
      </button>
    </div>
  );
}
