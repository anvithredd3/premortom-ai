"""PreMortem AI - FastAPI backend.

Endpoints
---------
GET  /health                 - service + mode (agentic/offline) status
POST /analyze                - run the full PreMortem (returns report JSON)
POST /upload                 - parse a document, return extracted text + fields
POST /report/{fmt}           - export report as json | pdf | docx
GET  /sample                 - the AIIMS MRI demo input
"""
from __future__ import annotations

import asyncio
import json

from pydantic import BaseModel
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

from .agents import extraction_agent, profiler_agent
from .agents.orchestrator import run_bid_evaluation, run_premortem, run_premortem_stream
from .models import PreMortemReport, ProcurementInput
from .services import bid_outputs, document_parser, input_bids, report as report_service
from .services.llm import has_api_key


class ProfileRequest(BaseModel):
    text: str

app = FastAPI(
    title="PreMortem AI",
    description="Agentic Procurement Failure Prediction Platform",
    version="1.0.0",
)


class BidCreateRequest(BaseModel):
    procurement_name: str
    equipment_type: str = ""


class BidRunRequest(BaseModel):
    bid_id: str
    quote_ids: list[str] = []

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "mode": "agentic" if has_api_key() else "offline (rule-based)",
        "service": "PreMortem AI",
    }


@app.get("/sample", response_model=ProcurementInput)
def sample():
    """AIIMS MRI demo procurement package."""
    return ProcurementInput()


@app.post("/analyze", response_model=PreMortemReport)
def analyze(data: ProcurementInput):
    if data.raw_document_text:
        data, _ = extraction_agent.extract(data.raw_document_text)
    return run_premortem(data)


@app.post("/analyze_stream")
async def analyze_stream(data: ProcurementInput):
    """SSE endpoint — emits JSON events as each agent finishes."""
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def sync_run() -> None:
        def send(event: dict) -> None:
            loop.call_soon_threadsafe(queue.put_nowait, event)
        try:
            run_premortem_stream(data, send)
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "message": str(exc)})
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel

    async def event_generator():
        fut = loop.run_in_executor(None, sync_run)
        while True:
            event = await queue.get()
            if event is None:
                break
            yield f"data: {json.dumps(event)}\n\n"
        await fut  # surface any unhandled exception

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.post("/profile")
def profile(request: ProfileRequest):
    """Classify text and web-research product norms into ProcurementInput fields.

    Returns {status:"OUT_OF_SCOPE", reason} or
            {status:"READY", category, proposed_fields, missing_fields, research}.
    """
    return profiler_agent.profile(request.text)


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    content = await file.read()
    text = document_parser.extract_text(file.filename, content)
    extracted_input, missing = extraction_agent.extract(text)
    return {
        "filename": file.filename,
        "characters": len(text),
        "extracted_fields": extracted_input.model_dump(exclude={"raw_document_text"}),
        "missing_fields": missing,
        "text_preview": text[:2000],
        "raw_document_text": text,
    }


@app.post("/report/{fmt}")
def export_report(fmt: str, report: PreMortemReport):
    fmt = fmt.lower()
    base = report.procurement_name.replace(" ", "_")
    if fmt == "json":
        return Response(
            report_service.to_json_bytes(report),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{base}_premortem.json"'
            },
        )
    if fmt == "pdf":
        return Response(
            report_service.to_pdf_bytes(report),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{base}_premortem.pdf"'
            },
        )
    if fmt in ("docx", "word"):
        return Response(
            report_service.to_docx_bytes(report),
            media_type=(
                "application/vnd.openxmlformats-officedocument."
                "wordprocessingml.document"
            ),
            headers={
                "Content-Disposition": f'attachment; filename="{base}_premortem.docx"'
            },
        )
    return Response(
        '{"error": "unsupported format"}',
        media_type="application/json",
        status_code=400,
    )


@app.post("/bids")
def create_bid(payload: BidCreateRequest):
    return input_bids.create_bid(payload.procurement_name, payload.equipment_type)


@app.get("/bids")
def list_bids():
    return input_bids.list_bids()


@app.post("/input/scan")
def scan_input_folder():
    return input_bids.scan_inputs()


@app.post("/bids/{bid_id}/quotes")
async def upload_quote(
    bid_id: str,
    vendor_name: str = Form(""),
    file: UploadFile = File(...),
):
    try:
        return input_bids.save_quote(
            bid_id,
            vendor_name,
            file.filename or "quote.pdf",
            file.file,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/bids/{bid_id}/quotes")
def list_quotes(bid_id: str):
    return input_bids.list_quotes(bid_id)


@app.post("/bid-runs")
def start_bid_run(payload: BidRunRequest, background_tasks: BackgroundTasks):
    quote_ids = payload.quote_ids or [
        quote["quote_id"] for quote in input_bids.list_quotes(payload.bid_id)["quotes"]
    ]
    if not quote_ids:
        raise HTTPException(status_code=400, detail="No quotes found for this bid")
    run = bid_outputs.create_run(payload.bid_id, quote_ids)
    background_tasks.add_task(
        run_bid_evaluation,
        run["run_id"],
        payload.bid_id,
        quote_ids,
    )
    return run


@app.get("/bid-runs/{run_id}/state")
def get_bid_run_state(run_id: str):
    return bid_outputs.get_state(run_id)


@app.get("/bid-runs/{run_id}/events")
def get_bid_run_events(run_id: str, since: int = 0):
    return bid_outputs.get_events(run_id, since)


@app.get("/bid-runs/{run_id}/graph")
def get_bid_run_graph(run_id: str):
    return bid_outputs.get_graph(run_id)


@app.get("/bid-runs/{run_id}/artifacts")
def list_bid_run_artifacts(run_id: str):
    return bid_outputs.list_artifacts(run_id)


@app.get("/bid-runs/{run_id}/artifacts/{artifact_id}")
def get_bid_run_artifact(run_id: str, artifact_id: str):
    try:
        return bid_outputs.get_artifact(run_id, artifact_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/bid-runs/{run_id}/result")
def get_bid_run_result(run_id: str):
    return bid_outputs.get_result(run_id)


@app.get("/bids/{bid_id}/runs")
def list_bid_runs(bid_id: str):
    return bid_outputs.list_runs_for_bid(bid_id)


@app.get("/bids/{bid_id}/latest-run")
def get_latest_bid_run(bid_id: str):
    try:
        return bid_outputs.get_latest_run_for_bid(bid_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/bids/{bid_id}/latest-state")
def get_latest_bid_run_state(bid_id: str):
    try:
        run = bid_outputs.get_latest_run_for_bid(bid_id)
        return bid_outputs.get_state(run["run_id"])
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/bids/{bid_id}/latest-graph")
def get_latest_bid_run_graph(bid_id: str):
    try:
        run = bid_outputs.get_latest_run_for_bid(bid_id)
        return bid_outputs.get_graph(run["run_id"])
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/bids/{bid_id}/latest-artifacts")
def list_latest_bid_run_artifacts(bid_id: str):
    try:
        run = bid_outputs.get_latest_run_for_bid(bid_id)
        return bid_outputs.list_artifacts(run["run_id"])
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/bids/{bid_id}/latest-result")
def get_latest_bid_run_result(bid_id: str):
    try:
        run = bid_outputs.get_latest_run_for_bid(bid_id)
        return bid_outputs.get_result(run["run_id"])
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
