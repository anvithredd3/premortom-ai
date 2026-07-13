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

import os
import re
from typing import Any

from pydantic import BaseModel, Field
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .agents import extraction_agent, ui_guidance_agent
from .agents.orchestrator import run_bid_evaluation, run_premortem
from .models import PreMortemReport, ProcurementInput
from .services import (
    bid_outputs,
    db_status,
    document_parser,
    input_bids,
    report as report_service,
    rfq_store,
)
from .services.llm import has_api_key
from .services.decision_history_pgvector import store_ui_guidance_agent_history
from .services.okf_memory import write_okf_memory_index
from .services.okf_pgvector import index_okf_chunks_pgvector, pgvector_index_config

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


class DemoRunRequest(ProcurementInput):
    selected_bid_id: str = "BID-001"
    selected_quote_id: str = ""


class UiGuidanceRequest(BaseModel):
    mode: str = "rfq_intake"
    role: str = "procurement_officer"
    free_text: str = ""
    static_inputs: dict[str, Any] = Field(default_factory=dict)
    feature_weights: dict[str, float] = Field(default_factory=dict)
    minimum_criteria: list[str] = Field(default_factory=list)
    negotiable_criteria: list[str] = Field(default_factory=list)
    bid_id: str = ""
    quote_id: str = ""
    vendor_proposal: dict[str, Any] = Field(default_factory=dict)
    store_history: bool = True


class RfqRequirementRequest(BaseModel):
    id: str
    entered_by_role: str = ""
    role: str = ""
    perspective_role: str = ""
    requirement: str
    priority_rank: int
    perspective_value_pct: float
    estimated_cost_cr: float | None = None
    cost_confidence: str = "unknown"
    cost_source: str = "unknown"
    notes: str = ""
    status: str = "accepted"


class RfqPublishRequest(BaseModel):
    rfq_id: str = ""
    procurement_name: str
    equipment_type: str = ""
    budget_cr: float = 0
    requirements: list[RfqRequirementRequest] = Field(default_factory=list)
    minimum_criteria: list[str] = Field(default_factory=list)
    negotiable_criteria: list[str] = Field(default_factory=list)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def write_memory_indexes_on_startup() -> None:
    if os.getenv("OKF_WRITE_MEMORY_INDEX", "0") in {"1", "true", "True"}:
        write_okf_memory_index()

    if os.getenv("OKF_INDEX_PGVECTOR", "0") in {"1", "true", "True"}:
        try:
            count = index_okf_chunks_pgvector()
            config = pgvector_index_config()
            print(
                "Indexed "
                f"{count} OKF memory chunks into pgvector "
                f"(embedding={config['embedding_method']}, "
                f"dims={config['vector_dims']}, "
                f"chunking={config['chunk_strategy']}, "
                f"history_indexed={config['stores_history']})."
            )
        except Exception as exc:
            print(f"Skipping pgvector OKF index: {exc}")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "mode": "agentic" if has_api_key() else "offline (rule-based)",
        "service": "PreMortem AI",
    }


@app.get("/db/status")
def database_status():
    return db_status.get_database_status()


@app.post("/rfq/publish")
def publish_rfq(payload: RfqPublishRequest):
    if not payload.requirements:
        raise HTTPException(status_code=400, detail="Cannot publish RFQ without requirements.")
    if payload.budget_cr < 0:
        raise HTTPException(status_code=400, detail="RFQ budget cannot be negative.")
    for req in payload.requirements:
        if req.priority_rank < 1:
            raise HTTPException(status_code=400, detail=f"{req.id}: priority must be 1 or higher.")
        if req.perspective_value_pct < 0 or req.perspective_value_pct > 100:
            raise HTTPException(status_code=400, detail=f"{req.id}: value percentage must be 0-100.")
        if req.estimated_cost_cr is not None and req.estimated_cost_cr < 0:
            raise HTTPException(status_code=400, detail=f"{req.id}: cost cannot be negative.")
    try:
        return rfq_store.publish_rfq(payload.model_dump(mode="json"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"RFQ publish storage failed: {exc}") from exc


@app.get("/sample", response_model=ProcurementInput)
def sample():
    """AIIMS MRI demo procurement package."""
    return ProcurementInput()


@app.post("/analyze", response_model=PreMortemReport)
def analyze(data: ProcurementInput):
    if data.raw_document_text:
        data, _ = extraction_agent.extract(data.raw_document_text)
    return run_premortem(data)


@app.post("/analyze/demo-run")
def analyze_and_start_demo_bid_run(data: DemoRunRequest):
    """Run the existing single analysis and also add it to the BID-001 bid flow."""
    print("Demo run: starting Screen 1 single-case analysis.", flush=True)
    source_data = ProcurementInput(
        **data.model_dump(exclude={"selected_bid_id", "selected_quote_id"})
    )
    if source_data.raw_document_text:
        source_data, _ = extraction_agent.extract(source_data.raw_document_text)

    report = run_premortem(source_data)
    print("Demo run: single-case analysis complete.", flush=True)
    inferred_bid_id, inferred_quote_id = _quote_id_from_text(data.raw_document_text or "")
    selected_quote_id = data.selected_quote_id or inferred_quote_id
    bid_id = data.selected_bid_id or inferred_bid_id or "BID-001"
    sample: dict[str, Any] = {}
    if selected_quote_id:
        quote_ids = _demo_quote_ids_for_selected(bid_id, selected_quote_id)
        print(
            f"Demo run: using selected existing quote {selected_quote_id}; "
            "no new Screen 1 sample registered.",
            flush=True,
        )
    else:
        sample = input_bids.save_procurement_input_sample(
            bid_id,
            source_data.model_dump(),
        )
        print(
            f"Demo run: registered current Screen 1 input as {sample['sample_id']}.",
            flush=True,
        )
        quote_ids = _demo_quote_ids_for_selected(bid_id, sample["quote_id"])
    run = bid_outputs.create_run(bid_id, quote_ids)
    print(
        f"Demo run: starting bid recommender workflow {run['run_id']} "
        f"with {len(quote_ids)} quotes: {', '.join(quote_ids)}.",
        flush=True,
    )
    run_bid_evaluation(run["run_id"], bid_id, quote_ids)
    print(f"Demo run: bid recommender workflow {run['run_id']} complete.", flush=True)
    return {
        "report": report.model_dump(mode="json"),
        "bid_id": bid_id,
        "sample_id": sample.get("sample_id", ""),
        "quote_id": selected_quote_id or sample.get("quote_id", ""),
        "quote_ids": quote_ids,
        "sample": sample,
        "bid_run": run,
    }


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    content = await file.read()
    text = document_parser.extract_text(file.filename, content)
    extracted_input, missing = extraction_agent.extract(text)
    selected_bid_id, selected_quote_id = _quote_id_from_filename(file.filename)
    return {
        "filename": file.filename,
        "characters": len(text),
        "extracted_fields": extracted_input.model_dump(exclude={"raw_document_text"}),
        "missing_fields": missing,
        "text_preview": text[:2000],
        "raw_document_text": text,
        "selected_bid_id": selected_bid_id,
        "selected_quote_id": selected_quote_id,
    }


def _quote_id_from_filename(filename: str) -> tuple[str, str]:
    match = re.search(r"(BID-\d{3,})-Q(\d{2,})", filename or "", flags=re.I)
    if not match:
        return "", ""
    bid_id = match.group(1).upper()
    return bid_id, f"{bid_id}-Q{match.group(2)}"


def _quote_id_from_text(text: str) -> tuple[str, str]:
    match = re.search(r"(BID-\d{3,})-Q(\d{2,})", text or "", flags=re.I)
    if not match:
        return "", ""
    bid_id = match.group(1).upper()
    return bid_id, f"{bid_id}-Q{match.group(2)}"


def _demo_quote_ids_for_selected(bid_id: str, selected_quote_id: str) -> list[str]:
    baseline = [f"{bid_id}-Q{idx:02d}" for idx in range(1, 6)]
    if selected_quote_id not in baseline:
        baseline.append(selected_quote_id)
    available = {
        quote["quote_id"]
        for quote in input_bids.list_quotes(bid_id)["quotes"]
    }
    return [quote_id for quote_id in baseline if quote_id in available]


@app.post("/ui-guidance/rfq-negotiation")
def run_ui_guidance(payload: UiGuidanceRequest):
    if payload.vendor_proposal:
        result = ui_guidance_agent.analyze_vendor_proposal(
            payload.vendor_proposal,
            source_name=(
                str(payload.vendor_proposal.get("quote_id") or payload.quote_id)
                or "vendor_proposal"
            ),
        )
    else:
        source_text = "\n".join(
            item
            for item in (
                payload.free_text,
                _format_ui_static_inputs(payload.static_inputs),
                _format_ui_criteria(payload.minimum_criteria, payload.negotiable_criteria),
            )
            if item
        )
        result = ui_guidance_agent.analyze_text(
            raw_document_text=source_text,
            source_name="ui_guidance_request",
        )

    result["mode"] = payload.mode
    result["request_context"] = {
        "role": payload.role,
        "free_text": payload.free_text,
        "static_inputs": payload.static_inputs,
        "feature_weights": payload.feature_weights,
        "minimum_criteria": payload.minimum_criteria,
        "negotiable_criteria": payload.negotiable_criteria,
        "bid_id": payload.bid_id,
        "quote_id": payload.quote_id,
    }
    result["feature_weight_feedback"] = _feature_weight_feedback(payload.feature_weights)
    result["history"] = {"stored": False, "run_id": "", "error": ""}

    if payload.store_history:
        try:
            run_id = store_ui_guidance_agent_history(
                result=result,
                bid_id=payload.bid_id,
                quote_id=payload.quote_id
                or str(payload.vendor_proposal.get("quote_id") or ""),
                source_name=str(result.get("source_name") or "ui_guidance_request"),
            )
            result["history"] = {"stored": True, "run_id": run_id, "error": ""}
        except Exception as exc:
            result["history"] = {"stored": False, "run_id": "", "error": str(exc)}
    return result


def _format_ui_static_inputs(static_inputs: dict[str, Any]) -> str:
    if not static_inputs:
        return ""
    lines = ["Static expectation inputs:"]
    for key, value in sorted(static_inputs.items()):
        if value not in (None, "", [], {}):
            lines.append(f"- {key}: {value}")
    return "\n".join(lines)


def _format_ui_criteria(
    minimum_criteria: list[str],
    negotiable_criteria: list[str],
) -> str:
    lines = []
    if minimum_criteria:
        lines.append("Minimum criteria:")
        lines.extend(f"- {item}" for item in minimum_criteria if item)
    if negotiable_criteria:
        lines.append("Negotiable criteria:")
        lines.extend(f"- {item}" for item in negotiable_criteria if item)
    return "\n".join(lines)


def _feature_weight_feedback(weights: dict[str, float]) -> list[str]:
    if not weights:
        return ["No feature weights were provided."]
    total = sum(float(value or 0) for value in weights.values())
    feedback = [f"Feature weights total {total:g}."]
    if abs(total - 100.0) > 0.01:
        feedback.append("Feature weights should ideally total 100; normalize or review before final use.")
    if any(float(value or 0) < 0 for value in weights.values()):
        feedback.append("Feature weights should not be negative.")
    if weights:
        top = sorted(weights.items(), key=lambda item: float(item[1] or 0), reverse=True)[:3]
        feedback.append(
            "Top weighted criteria: "
            + ", ".join(f"{key}={float(value):g}" for key, value in top)
            + "."
        )
    return feedback


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
