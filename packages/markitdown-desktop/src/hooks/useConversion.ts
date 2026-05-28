import { useState, useCallback } from "react";
import { convertFile, convertUrl, ConvertOptions, ConvertResult } from "@/lib/api";

export type ConversionStatus = "idle" | "loading" | "success" | "error";

export interface ConversionState {
  status: ConversionStatus;
  result: ConvertResult | null;
  error: string | null;
}

export function useConversion(options: ConvertOptions) {
  const [state, setState] = useState<ConversionState>({
    status: "idle",
    result: null,
    error: null,
  });

  const convert = useCallback(
    async (input: { path?: string; url?: string }) => {
      setState({ status: "loading", result: null, error: null });
      try {
        let result: ConvertResult;
        if (input.path) {
          result = await convertFile(input.path, options);
        } else if (input.url) {
          result = await convertUrl(input.url, options);
        } else {
          throw new Error("Provide a file path or URL.");
        }

        // Wrap the markdown with clear BEGIN / END markers
        const label = result.source.split(/[\\/]/).pop() ?? result.source;
        result = {
          ...result,
          markdown:
            `----- BEGIN content of ${label} -----\n\n` +
            result.markdown.trim() +
            `\n\n----- END content of ${label} -----`,
        };

        setState({ status: "success", result, error: null });
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setState({ status: "error", result: null, error: msg });
        return null;
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setState({ status: "idle", result: null, error: null });
  }, []);

  return { ...state, convert, reset };
}
