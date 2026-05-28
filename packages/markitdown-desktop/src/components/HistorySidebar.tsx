import { formatTokens } from "@/lib/utils";
import { HistoryItem } from "@/lib/settings";
import { Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistorySidebarProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
}

export function HistorySidebar({ history, onSelect }: HistorySidebarProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-12">
        <Clock className="w-8 h-8 opacity-30" />
        <p className="text-sm">No history yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1">
        Recent
      </p>
      {history.map((item) => {
        const name = item.source.split(/[\\/]/).pop() ?? item.source;
        const date = new Date(item.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className={cn(
              "flex items-start gap-2 px-3 py-2 rounded-lg text-left hover:bg-muted transition-colors"
            )}
          >
            <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{name}</p>
              <p className="text-xs text-muted-foreground">
                ~{formatTokens(item.tokenCount)} tokens · {date}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
