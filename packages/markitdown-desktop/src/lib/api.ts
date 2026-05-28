/**
 * HTTP client for the Python sidecar.
 * The sidecar port is written to localStorage by the Tauri main.rs command.
 */

export interface ConvertOptions {
  llm_api_key?: string;
  llm_model?: string;
  llm_client_type?: string;
  llm_prompt?: string;
  docintel_endpoint?: string;
  cu_endpoint?: string;
}

export interface ConvertResult {
  markdown: string;
  detected_format: string | null;
  source: string;
}

export interface BatchResultItem {
  path: string;
  markdown: string;
  error: string | null;
}

export interface CapabilitiesResult {
  formats: string[];
  optional_features: string[];
}

function getBaseUrl(): string {
  const port = localStorage.getItem("sidecar_port") || "8765";
  return `http://127.0.0.1:${port}`;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore parse error
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function ping(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/ping`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getCapabilities(): Promise<CapabilitiesResult> {
  const res = await fetch(`${getBaseUrl()}/capabilities`);
  return handleResponse<CapabilitiesResult>(res);
}

export async function convertFile(
  path: string,
  options: ConvertOptions = {}
): Promise<ConvertResult> {
  const res = await fetch(`${getBaseUrl()}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, ...options }),
  });
  return handleResponse<ConvertResult>(res);
}

export async function convertUrl(
  url: string,
  options: ConvertOptions = {}
): Promise<ConvertResult> {
  const res = await fetch(`${getBaseUrl()}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, ...options }),
  });
  return handleResponse<ConvertResult>(res);
}

export async function convertBatch(
  paths: string[],
  options: ConvertOptions = {}
): Promise<BatchResultItem[]> {
  const res = await fetch(`${getBaseUrl()}/convert-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths, ...options }),
  });
  const data = await handleResponse<{ results: BatchResultItem[] }>(res);
  return data.results;
}
