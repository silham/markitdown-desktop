import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { estimateTokens, formatTokens } from "@/lib/utils";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownPreviewProps {
  markdown: string;
  source?: string;
}

export function MarkdownPreview({ markdown, source }: MarkdownPreviewProps) {
  const [view, setView] = useState<"preview" | "raw">("preview");

  const tokenCount = useMemo(() => estimateTokens(markdown), [markdown]);
  const formatted = useMemo(() => formatTokens(tokenCount), [tokenCount]);

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {/* Token badge */}
          <div className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-semibold">
            <Coins className="w-3.5 h-3.5" />
            <span>~{formatted} tokens</span>
          </div>
          {source && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={source}>
              {source.split(/[\\/]/).pop() ?? source}
            </span>
          )}
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            className={cn(
              "px-3 py-1 text-xs rounded-md transition-colors",
              view === "preview"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setView("preview")}
          >
            Preview
          </button>
          <button
            className={cn(
              "px-3 py-1 text-xs rounded-md transition-colors",
              view === "raw"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setView("raw")}
          >
            Raw
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-background p-4">
        {view === "preview" ? (
          <div className="markdown-preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground">
            {markdown}
          </pre>
        )}
      </div>
    </div>
  );
}
