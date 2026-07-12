"""Historical procurement knowledge base.

A small curated dataset of past public-procurement outcomes. When ChromaDB and
OpenAI embeddings are available we index it for semantic retrieval; otherwise we
fall back to a simple keyword match. Either way the Historical Intelligence
Agent gets comparable benchmark projects.
"""
from __future__ import annotations

import os
from typing import List

HISTORICAL_PROJECTS: List[dict] = [
    {
        "id": "AIIMS-MRI-2019",
        "equipment": "MRI Machine",
        "summary": "AIIMS MRI procured before MRI room construction finished. "
        "Electrical and radiation clearance pending. No operators hired.",
        "delay_months": 9,
        "outcome": "Equipment idle 9 months, warranty partially lost.",
        "readiness_pct": 60,
        "vendor_performance": "On-time delivery, no installation support.",
        "failed": True,
    },
    {
        "id": "STATE-CT-2020",
        "equipment": "CT Scanner",
        "summary": "CT scanner delivered with 70% civil readiness, power backup "
        "pending. Two of four technicians trained.",
        "delay_months": 7,
        "outcome": "7-month delay, underutilised for first year.",
        "readiness_pct": 70,
        "vendor_performance": "Average; delayed commissioning.",
        "failed": True,
    },
    {
        "id": "DISTRICT-LINAC-2018",
        "equipment": "Linear Accelerator",
        "summary": "LINAC bunker incomplete, AERB approval pending at delivery. "
        "Advance of 50% released early.",
        "delay_months": 11,
        "outcome": "11-month delay, significant idle-cost exposure.",
        "readiness_pct": 55,
        "vendor_performance": "Poor; minimal coordination.",
        "failed": True,
    },
    {
        "id": "MEDCOLL-USG-2021",
        "equipment": "Ultrasound",
        "summary": "Ultrasound delivered to a fully ready facility with trained "
        "sonographers and completed approvals.",
        "delay_months": 1,
        "outcome": "Commissioned on schedule, high utilisation.",
        "readiness_pct": 98,
        "vendor_performance": "Excellent; turnkey installation.",
        "failed": False,
    },
    {
        "id": "AIIMS-MRI-72CR-2017",
        "equipment": "MRI Machine",
        "summary": "Flagship ₹72 Cr MRI suite procured ahead of infrastructure. "
        "Installation planning missing, operators unavailable, warranty started "
        "before commissioning.",
        "delay_months": 8,
        "outcome": "Asset unused; landmark procurement failure.",
        "readiness_pct": 58,
        "vendor_performance": "Delivered early, no readiness check.",
        "failed": True,
    },
    {
        "id": "STATE-XRAY-2022",
        "equipment": "Digital X-Ray",
        "summary": "Digital X-ray for a ready PHC with technician on staff and "
        "electrical work complete.",
        "delay_months": 2,
        "outcome": "Smooth commissioning, minor delay.",
        "readiness_pct": 95,
        "vendor_performance": "Good.",
        "failed": False,
    },
]


_collection = None


def _try_build_chroma():
    global _collection
    if _collection is not None:
        return _collection
    if os.getenv("ENABLE_CHROMA_HISTORY", "0") not in {"1", "true", "True"}:
        return None
    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        return None  # ChromaDB embedding path requires OpenAI; keyword fallback used otherwise
    try:
        import chromadb
        from chromadb.config import Settings
        from chromadb.utils import embedding_functions

        ef = embedding_functions.OpenAIEmbeddingFunction(
            api_key=openai_key,
            model_name=os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small"),
        )
        client = chromadb.Client(Settings(anonymized_telemetry=False))
        col = client.get_or_create_collection("procurements", embedding_function=ef)
        if col.count() == 0:
            col.add(
                ids=[p["id"] for p in HISTORICAL_PROJECTS],
                documents=[p["summary"] for p in HISTORICAL_PROJECTS],
                metadatas=[
                    {k: v for k, v in p.items() if k != "summary"}
                    for p in HISTORICAL_PROJECTS
                ],
            )
        _collection = col
        return col
    except Exception:
        return None


def find_similar(query: str, equipment: str, k: int = 4) -> List[dict]:
    """Return the k most similar historical projects."""
    col = _try_build_chroma()
    if col is not None:
        try:
            res = col.query(query_texts=[query], n_results=k)
            ids = res["ids"][0]
            return [p for pid in ids for p in HISTORICAL_PROJECTS if p["id"] == pid]
        except Exception:
            pass

    # Keyword fallback: prefer same equipment, then failed projects.
    eq = (equipment or "").lower()
    scored = sorted(
        HISTORICAL_PROJECTS,
        key=lambda p: (
            0 if eq and eq.split()[0] in p["equipment"].lower() else 1,
            0 if p["failed"] else 1,
        ),
    )
    return scored[:k]
