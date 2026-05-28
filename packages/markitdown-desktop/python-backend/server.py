"""
MarkItDown Desktop — Python sidecar
Wraps markitdown and exposes a local HTTP API for the Tauri frontend.
"""

import os
import sys
import socket
import asyncio
import tempfile
import traceback
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Import markitdown — support running from source or installed
# ---------------------------------------------------------------------------
try:
    from markitdown import MarkItDown, UnsupportedFormatException, FileConversionException
except ImportError as e:
    print(f"ERROR: markitdown not found: {e}", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="MarkItDown Desktop Sidecar", version="0.1.0")

# Allow the Tauri webview origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["tauri://localhost", "https://tauri.localhost", "http://localhost:*", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ConvertRequest(BaseModel):
    path: Optional[str] = None
    url: Optional[str] = None
    llm_client_type: Optional[str] = None   # "openai" | None
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    llm_prompt: Optional[str] = None
    docintel_endpoint: Optional[str] = None
    cu_endpoint: Optional[str] = None


class ConvertBatchRequest(BaseModel):
    paths: list[str]
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    docintel_endpoint: Optional[str] = None
    cu_endpoint: Optional[str] = None


class ConvertResult(BaseModel):
    markdown: str
    detected_format: Optional[str] = None
    source: str


class BatchResult(BaseModel):
    results: list[dict]


class CapabilitiesResult(BaseModel):
    formats: list[str]
    optional_features: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SUPPORTED_FORMATS = [
    "PDF (.pdf)", "Word (.docx)", "PowerPoint (.pptx)",
    "Excel (.xlsx, .xls)", "Images (.jpg, .png, .gif, .bmp, .tiff, .webp)",
    "Audio (.wav, .mp3)", "HTML (.html, .htm)", "CSV (.csv)",
    "JSON (.json)", "XML (.xml)", "Plain text (.txt, .md)",
    "Jupyter Notebook (.ipynb)", "Outlook Message (.msg)",
    "ZIP archive (.zip)", "EPUB (.epub)",
    "YouTube URLs", "Wikipedia URLs", "Web pages (any URL)",
]

def _build_markitdown(req_data: dict) -> MarkItDown:
    """Build a MarkItDown instance from request parameters."""
    kwargs: dict = {}

    llm_client = None
    if req_data.get("llm_api_key") and req_data.get("llm_client_type") == "openai":
        try:
            from openai import OpenAI
            llm_client = OpenAI(api_key=req_data["llm_api_key"])
        except ImportError:
            pass  # openai not installed — skip LLM features silently

    if llm_client:
        kwargs["llm_client"] = llm_client
        kwargs["llm_model"] = req_data.get("llm_model") or "gpt-4o"
        if req_data.get("llm_prompt"):
            kwargs["llm_prompt"] = req_data["llm_prompt"]

    if req_data.get("docintel_endpoint"):
        kwargs["docintel_endpoint"] = req_data["docintel_endpoint"]

    if req_data.get("cu_endpoint"):
        kwargs["cu_endpoint"] = req_data["cu_endpoint"]

    return MarkItDown(**kwargs)


def _friendly_error(exc: Exception) -> str:
    """Convert library exceptions into plain-English messages."""
    msg = str(exc)
    if "password" in msg.lower() or "encrypted" in msg.lower():
        return "This file is password-protected and cannot be converted."
    if isinstance(exc, UnsupportedFormatException):
        return "This file format is not supported."
    if isinstance(exc, FileConversionException):
        return f"Conversion failed: {msg}"
    if "not found" in msg.lower() or "no such file" in msg.lower():
        return "File not found. Please check the path and try again."
    return f"An unexpected error occurred: {msg}"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/ping")
def ping():
    return {"status": "ok"}


@app.get("/capabilities", response_model=CapabilitiesResult)
def capabilities():
    optional = []

    try:
        import openai  # noqa: F401
        optional.append("llm-descriptions (openai installed)")
    except ImportError:
        pass

    try:
        import azure.ai.documentintelligence  # noqa: F401
        optional.append("azure-document-intelligence")
    except ImportError:
        pass

    try:
        import azure.ai.contentunderstanding  # noqa: F401
        optional.append("azure-content-understanding")
    except ImportError:
        pass

    return CapabilitiesResult(formats=SUPPORTED_FORMATS, optional_features=optional)


@app.post("/convert", response_model=ConvertResult)
def convert(req: ConvertRequest):
    if not req.path and not req.url:
        raise HTTPException(status_code=400, detail="Provide either 'path' or 'url'.")

    source = req.url if req.url else req.path

    try:
        md = _build_markitdown(req.model_dump())
        if req.path:
            result = md.convert_local(req.path)
        else:
            result = md.convert(req.url)
    except (UnsupportedFormatException, FileConversionException) as exc:
        raise HTTPException(status_code=422, detail=_friendly_error(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=_friendly_error(exc))
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=_friendly_error(exc))

    return ConvertResult(
        markdown=result.text_content or "",
        detected_format=None,
        source=source,
    )


@app.post("/convert-batch", response_model=BatchResult)
def convert_batch(req: ConvertBatchRequest):
    md = _build_markitdown(req.model_dump())
    results = []
    for path in req.paths:
        try:
            result = md.convert_local(path)
            results.append({
                "path": path,
                "markdown": result.text_content or "",
                "error": None,
            })
        except Exception as exc:
            results.append({
                "path": path,
                "markdown": "",
                "error": _friendly_error(exc),
            })
    return BatchResult(results=results)


# ---------------------------------------------------------------------------
# Entrypoint — print port to stdout so Tauri can read it
# ---------------------------------------------------------------------------

def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


if __name__ == "__main__":
    port = int(os.environ.get("SIDECAR_PORT", _find_free_port()))
    # Print port on its own line — Tauri reads this from stdout
    print(f"SIDECAR_PORT={port}", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
