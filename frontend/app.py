"""PreMortem AI - Streamlit frontend.

Five primary screens plus bonus visualizations, all powered by the FastAPI
backend. Run with:  streamlit run app.py
"""
from __future__ import annotations

import time
import math
import re

import streamlit as st

import api_client as api
import charts

st.set_page_config(
    page_title="PreMortem AI",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --------------------------------------------------------------------------- #
# Styling
# --------------------------------------------------------------------------- #
st.markdown(
    """
    <style>
    .main-title {font-size: 2.3rem; font-weight: 800; color: #0f172a; margin-bottom:0;}
    .tagline {color:#64748b; font-style:italic; margin-top:0;}
    .agent-card {border:1px solid #e2e8f0; border-radius:12px; padding:16px;
                 background:#ffffff; box-shadow:0 1px 3px rgba(0,0,0,0.06);}
    .badge {display:inline-block; padding:3px 12px; border-radius:999px;
            color:white; font-weight:700; font-size:0.8rem;}
    .decision-go {background:#16a34a;}
    .decision-cond {background:#d97706;}
    .decision-nogo {background:#dc2626;}
    .neon-slide {
        background:#050914;
        border:1px solid #00e5ff;
        border-radius:42px;
        padding:28px 32px;
        margin:18px 0;
        color:#eaf6ff;
        box-shadow:0 0 20px rgba(0,229,255,0.16);
    }
    .neon-slide h2 {
        color:#ffffff;
        font-size:2rem;
        font-weight:800;
        margin:0 0 6px 0;
        letter-spacing:0;
    }
    .neon-slide h3 {
        color:#00f5ff;
        font-size:1rem;
        font-weight:500;
        margin:0 0 22px 0;
        letter-spacing:0;
        text-transform:uppercase;
    }
    .neon-accent {
        width:180px;
        height:5px;
        background:#ff2bd6;
        border-radius:999px;
        margin:0 0 24px 0;
    }
    .neon-grid {
        display:grid;
        grid-template-columns:repeat(3, minmax(0, 1fr));
        gap:18px;
    }
    .neon-card {
        border:1px solid #16466b;
        border-radius:18px;
        background:#081120;
        padding:18px;
        min-height:150px;
    }
    .neon-card h4 {
        color:#00f5ff;
        font-size:1rem;
        margin:0 0 14px 0;
        text-transform:uppercase;
    }
    .neon-card ul {
        margin:0;
        padding-left:18px;
    }
    .neon-card li {
        margin:0 0 10px 0;
    }
    .neon-page {
        color:#00f5ff;
        text-align:right;
        font-weight:700;
        margin-top:20px;
    }
    @media (max-width: 900px) {
        .neon-grid {grid-template-columns:1fr;}
        .neon-slide {border-radius:24px; padding:22px;}
    }
    .about-hero {
        text-align:center;
        padding:34px 24px;
        border-radius:18px;
        background:radial-gradient(900px 420px at 20% -10%, #16233d 0%, #0b1220 60%);
        border:1px solid #24314d;
        color:#e6ecf7;
        margin-bottom:22px;
    }
    .about-hero h1 {font-size:2.4rem; margin:8px 0 4px;}
    .about-tag {color:#4f8cff; font-weight:700;}
    .about-sub {color:#9fb0cc; max-width:820px; margin:12px auto 0;}
    .about-pills {display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:18px;}
    .about-pill {
        background:#1d2942;
        border:1px solid #24314d;
        color:#9fb0cc;
        padding:6px 12px;
        border-radius:999px;
        font-size:0.8rem;
    }
    .about-card {
        background:linear-gradient(180deg, #121a2b 0%, #162034 100%);
        border:1px solid #24314d;
        border-radius:16px;
        padding:24px;
        margin-bottom:18px;
        color:#e6ecf7;
        box-shadow:0 10px 30px rgba(0,0,0,0.18);
    }
    .about-card h2 {margin:0 0 6px; color:#ffffff;}
    .about-card h3 {margin:18px 0 8px; color:#e6ecf7;}
    .about-muted {color:#9fb0cc; font-style:italic;}
    .about-badge {
        display:inline-block;
        font-size:0.72rem;
        letter-spacing:1px;
        text-transform:uppercase;
        color:#4f8cff;
        background:rgba(79,140,255,0.12);
        border:1px solid rgba(79,140,255,0.35);
        padding:3px 10px;
        border-radius:6px;
        margin-bottom:10px;
        font-weight:700;
    }
    .about-badge.impact {color:#38d39f; background:rgba(56,211,159,0.12); border-color:rgba(56,211,159,0.35);}
    .about-grid {display:grid; grid-template-columns:1fr 1fr; gap:14px;}
    .about-grid4 {display:grid; grid-template-columns:repeat(4, 1fr); gap:14px;}
    .about-box {
        background:#162034;
        border:1px solid #24314d;
        border-radius:12px;
        padding:14px;
    }
    .about-box h4 {margin:0 0 5px; color:#4f8cff;}
    .about-box p {margin:0; color:#9fb0cc; font-size:0.88rem;}
    .about-flow {display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:14px 0;}
    .about-step {background:#1d2942; border:1px solid #24314d; padding:6px 10px; border-radius:8px; font-size:0.82rem;}
    .about-arrow {color:#4f8cff; font-weight:800;}
    .about-kpi {background:#162034; border:1px solid #24314d; border-radius:12px; padding:14px; text-align:center;}
    .about-num {font-size:1.6rem; font-weight:800; color:#38d39f;}
    .about-label {font-size:0.78rem; color:#9fb0cc;}
    .about-card ul {margin:10px 0; padding-left:20px;}
    .about-card li {margin-bottom:7px;}
    div[data-testid="stFileUploader"] section {
        width:38px;
        height:38px;
        min-height:38px;
        padding:0;
        border:1px solid #cbd5e1;
        border-radius:999px;
        background:#ffffff;
        display:flex;
        align-items:center;
        justify-content:center;
    }
    div[data-testid="stFileUploader"] section > div,
    div[data-testid="stFileUploader"] section div,
    div[data-testid="stFileUploader"] section span,
    div[data-testid="stFileUploader"] section p,
    div[data-testid="stFileUploader"] small,
    div[data-testid="stFileUploader"] [data-testid="stFileUploaderDropzoneInstructions"] {
        display:none;
    }
    div[data-testid="stFileUploader"] button {
        width:38px !important;
        height:38px !important;
        min-width:38px !important;
        padding:0 !important;
        border-radius:999px !important;
        font-size:0 !important;
        color:transparent !important;
        overflow:hidden !important;
    }
    div[data-testid="stFileUploader"] button * {
        display:none !important;
    }
    div[data-testid="stFileUploader"] button::before {
        content:"📁";
        color:#0f172a;
        font-size:1.15rem;
        line-height:1;
    }
    div[data-testid="stFileUploader"] label {
        display:none;
    }
    div[data-testid="stFileUploader"] {
        min-width:42px;
        margin-top:16px;
    }
    div[data-testid="stTextArea"] textarea {
        min-height:68px !important;
        line-height:1.35rem !important;
        resize:none;
    }
    div[data-testid="stButton"] button[kind="secondary"] {
        border-radius:999px;
    }
    @media (max-width: 900px) {
        .about-grid, .about-grid4 {grid-template-columns:1fr;}
    }
    </style>
    """,
    unsafe_allow_html=True,
)

RISK_BADGE = {
    "LOW": "#16a34a",
    "MODERATE": "#eab308",
    "HIGH": "#f97316",
    "CRITICAL": "#dc2626",
}

# --------------------------------------------------------------------------- #
# Session state
# --------------------------------------------------------------------------- #
if "form" not in st.session_state:
    st.session_state.form = None
if "report" not in st.session_state:
    st.session_state.report = None
if "rfq_guidance" not in st.session_state:
    st.session_state.rfq_guidance = None
if "published_rfq" not in st.session_state:
    st.session_state.published_rfq = None
if "rfq_role" not in st.session_state:
    st.session_state.rfq_role = "management"
if "rfq_requirements" not in st.session_state:
    st.session_state.rfq_requirements = []
if "rfq_chat" not in st.session_state:
    st.session_state.rfq_chat = []
if "rfq_pending_requirement" not in st.session_state:
    st.session_state.rfq_pending_requirement = None
if "rfq_chat_input_version" not in st.session_state:
    st.session_state.rfq_chat_input_version = 0
if "rfq_budget_cr" not in st.session_state:
    st.session_state.rfq_budget_cr = 18.0
if "latest_bid_recommendation" not in st.session_state:
    st.session_state.latest_bid_recommendation = None
if "selected_rfq_quote_id" not in st.session_state:
    st.session_state.selected_rfq_quote_id = ""
if "selected_demo_bid_id" not in st.session_state:
    st.session_state.selected_demo_bid_id = ""
if "selected_demo_quote_id" not in st.session_state:
    st.session_state.selected_demo_quote_id = ""


def badge(text: str, color: str) -> str:
    return f'<span class="badge" style="background:{color}">{text}</span>'


def get_backend_status():
    try:
        return api.health()
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Header + nav
# --------------------------------------------------------------------------- #
st.markdown('<p class="main-title">🛡️ PreMortem AI</p>', unsafe_allow_html=True)
st.markdown(
    '<p class="tagline">Don\'t analyze failures after they happen. '
    "Predict them before approval.</p>",
    unsafe_allow_html=True,
)

status = get_backend_status()
with st.sidebar:
    st.header("Navigation")
    screen = st.radio(
        "Go to screen",
        [
            "1 · RFQ Intake",
            "2 · Vendor Procurement Input",
            "3 · Agent Investigation Board",
            "4 · Agent Debate Room",
            "5 · Procurement Risk Analysis",
            "6 · PreMortem Report",
            "7 · Database / Memory",
            "8 · Market Research",
            "★ Bonus Lab (What-If / Digital Twin)",
            "About PreMortem AI",
        ],
    )
    st.divider()
    if status:
        st.success(f"Backend online · {status.get('mode')}")
    else:
        st.error("Backend offline. Start FastAPI on :8000")
    if st.session_state.report:
        rep = st.session_state.report
        st.metric("Overall Risk", f"{rep['overall_risk_score']:.0f}/100")
        st.metric("Decision", rep["recommended_decision"])


# --------------------------------------------------------------------------- #
# Screen 0 - About
# --------------------------------------------------------------------------- #
def screen_about():
    st.subheader("About · PreMortem AI")
    st.markdown(
        """
<section class="about-hero">
  <div style="font-size:42px">🛡️</div>
  <div class="about-tag">PreMortem AI</div>
  <h1>Predicting Procurement Failures Before They Happen</h1>
  <div class="about-sub">
    A full-stack Agentic AI platform that simulates a structured business review board
    before a high-risk procurement is approved. Specialist agents investigate,
    compare, and a Decision Board issues an auditable GO / CONDITIONS / NO-GO verdict.
  </div>
  <div class="about-pills">
    <span class="about-pill">Agentic Orchestration</span>
    <span class="about-pill">Decision Board</span>
    <span class="about-pill">OKF + pgvector Memory</span>
    <span class="about-pill">Market Research</span>
    <span class="about-pill">AIIMS MRI Demo</span>
  </div>
</section>

<section class="about-card">
  <span class="about-badge">Solution Architect</span>
  <h2>1. The Friction</h2>
  <p class="about-muted">What friction exists that a standard program or human cannot solve efficiently?</p>
  <p>
    Procurement failures are visible before approval, but the warning signs are scattered.
    Risk lives across proposal text, payment terms, warranty clauses, installation ownership,
    site readiness, workforce readiness, market context, and past outcomes.
  </p>
  <div class="about-grid">
    <div class="about-box"><h4>Why linear logic struggles</h4><p>Inputs are unstructured, risks interact, and failure modes are emergent.</p></div>
    <div class="about-box"><h4>Why humans struggle</h4><p>No single reviewer is contract lawyer, engineer, accountant, historian, and market analyst.</p></div>
  </div>
</section>

<section class="about-card">
  <span class="about-badge">Solution Architect</span>
  <h2>2. How The Workflow Thinks And Acts</h2>
  <p>
    PreMortem AI runs a simulated review board. The orchestrator behaves like a manager:
    it assigns work, runs specialists, consolidates findings, and produces the decision package.
  </p>
  <div class="about-flow">
    <span class="about-step">Upload / Input</span><span class="about-arrow">→</span>
    <span class="about-step">Extraction</span><span class="about-arrow">→</span>
    <span class="about-step">Specialist Agents</span><span class="about-arrow">→</span>
    <span class="about-step">Market + History</span><span class="about-arrow">→</span>
    <span class="about-step">Decision Board</span><span class="about-arrow">→</span>
    <span class="about-step">Report</span>
  </div>
  <ul>
    <li>Perceives structured and unstructured procurement evidence.</li>
    <li>Delegates review to focused specialist agents.</li>
    <li>Uses memory, market context, and artifacts for grounded decisions.</li>
    <li>Falls back clearly when live LLM/API access fails.</li>
  </ul>
</section>

<section class="about-card">
  <span class="about-badge">Solution Architect</span>
  <h2>3. Agent Persona</h2>
  <p>PreMortem AI is an AI Decision Auditor: an autonomous agentic expert team with human touch.</p>
  <div class="about-grid">
    <div class="about-box"><h4>Vendor Proposal Agent</h4><p>Extracts comparable fields, omissions, vague text, and proposal evidence.</p></div>
    <div class="about-box"><h4>Contract Review Agent</h4><p>Reviews warranty, payment, installation, training, and service risk.</p></div>
    <div class="about-box"><h4>Market Research Agent</h4><p>Adds product, vendor, lifecycle, and benchmark context.</p></div>
    <div class="about-box"><h4>Bid Recommender</h4><p>Ranks vendors, tradeoffs, cutoffs, and negotiation conditions.</p></div>
    <div class="about-box"><h4>Decision Board</h4><p>Consolidates the final recommendation and conditions.</p></div>
    <div class="about-box"><h4>Human Touch</h4><p>Humans provide governance, judgment, approval, and accountability.</p></div>
  </div>
</section>

<section class="about-card">
  <span class="about-badge">Solution Architect</span>
  <h2>4. Toolset And Technical Stack</h2>
  <div class="about-grid">
    <div class="about-box"><h4>Agentic AI</h4><p>OpenAI APIs, specialist agents, tool/search capability, Decision Board, fallback mode.</p></div>
    <div class="about-box"><h4>Memory</h4><p>OKF, RAG, vector embeddings, pgvector, decision history, agent history.</p></div>
    <div class="about-box"><h4>Application</h4><p>Streamlit frontend, FastAPI backend, PDF/text parsing, JSON artifacts.</p></div>
    <div class="about-box"><h4>Deployment</h4><p>Docker Compose with PostgreSQL + pgvector and local demo fallback.</p></div>
  </div>
</section>

<section class="about-card">
  <span class="about-badge impact">Business Impact</span>
  <h2>5. Business Value And ROI</h2>
  <div class="about-grid4">
    <div class="about-kpi"><div class="about-num">[N]</div><div class="about-label">bids tested</div></div>
    <div class="about-kpi"><div class="about-num">[N]</div><div class="about-label">quote samples</div></div>
    <div class="about-kpi"><div class="about-num">[%]</div><div class="about-label">accuracy / agreement</div></div>
    <div class="about-kpi"><div class="about-num">₹</div><div class="about-label">avoidable exposure</div></div>
  </div>
  <ul>
    <li>Prevents capital write-offs before approval.</li>
    <li>Makes GO / CONDITIONS / NO-GO decisions explainable and audit-ready.</li>
    <li>Improves negotiation readiness and vendor selection quality.</li>
    <li>Preserves institutional procurement memory for future reviews.</li>
  </ul>
</section>

<section class="about-card">
  <span class="about-badge">Future Steps</span>
  <h2>6. Scale And Growth</h2>
  <ul>
    <li>Add Quality Evaluation Agent for evidence, confidence, and benchmark checks.</li>
    <li>Expand RFQ intake and negotiation guidance.</li>
    <li>Add invoice monitoring and contract compliance for post-award leakage.</li>
    <li>Connect external tools through MCP and future A2A coordination.</li>
  </ul>
</section>
        """,
        unsafe_allow_html=True,
    )


def _neon_slide(title: str, subtitle: str, cards: list[tuple[str, list[str]]], page: str, lead: str = ""):
    card_html = []
    for heading, items in cards:
        bullets = "".join(f"<li>{item}</li>" for item in items)
        card_html.append(
            f'<div class="neon-card"><h4>{heading}</h4><ul>{bullets}</ul></div>'
        )
    lead_html = f"<p><strong>{lead}</strong></p>" if lead else ""
    st.markdown(
        (
            '<section class="neon-slide">'
            f"<h2>{title}</h2>"
            f"<h3>{subtitle}</h3>"
            '<div class="neon-accent"></div>'
            f"{lead_html}"
            f'<div class="neon-grid">{"".join(card_html)}</div>'
            f'<div class="neon-page">{page}</div>'
            "</section>"
        ),
        unsafe_allow_html=True,
    )


# --------------------------------------------------------------------------- #
# Screen 2 - Vendor Procurement Input
# --------------------------------------------------------------------------- #
def screen_input():
    st.subheader("Screen 2 · Vendor Procurement Input")
    if st.session_state.published_rfq:
        rfq = st.session_state.published_rfq
        st.success(
            "RFQ published. For this demo, vendor input is still entered here; "
            "later this page can enforce the published RFQ requirements."
        )
        with st.expander("Published RFQ Context"):
            st.markdown(f"**Procurement:** {rfq.get('procurement_name', '')}")
            st.markdown(f"**Equipment / Service:** {rfq.get('equipment_type', '')}")
            _bullet_block("Minimum Criteria", rfq.get("minimum_criteria", []))
            _bullet_block("Negotiable Criteria", rfq.get("negotiable_criteria", []))

    col_a, col_b = st.columns([2, 1])
    with col_b:
        st.markdown("**Quick start**")
        if st.button("Load AIIMS MRI demo", use_container_width=True):
            try:
                st.session_state.form = api.sample_input()
                st.session_state.selected_demo_bid_id = ""
                st.session_state.selected_demo_quote_id = ""
                st.success("Demo loaded.")
            except Exception as e:
                st.error(f"Could not load sample: {e}")
        up = st.file_uploader(
            "Upload procurement document (PDF / DOCX / TXT)",
            type=["pdf", "docx", "txt", "md", "csv"],
        )
        if up is not None and st.button("Parse document", use_container_width=True):
            try:
                res = api.upload(up.name, up.getvalue())
                st.session_state.form = {
                    **(st.session_state.form or api.sample_input()),
                    **res["extracted_fields"],
                    "raw_document_text": res["raw_document_text"],
                }
                inferred_bid_id, inferred_quote_id = _quote_id_from_filename(up.name)
                st.session_state.selected_demo_bid_id = res.get("selected_bid_id", "") or inferred_bid_id
                st.session_state.selected_demo_quote_id = res.get("selected_quote_id", "") or inferred_quote_id
                st.success(
                    f"Parsed {res['characters']} chars · "
                    f"{len(res['extracted_fields'])} fields auto-filled."
                )
                if st.session_state.selected_demo_quote_id:
                    st.caption(
                        "Selected existing bid quote for demo run: "
                        f"{st.session_state.selected_demo_quote_id}. "
                        "The run will compare Q01-Q05 plus this quote."
                    )
            except Exception as e:
                st.error(f"Parse failed: {e}")

    f = st.session_state.form or _default_form()

    with col_a:
        with st.form("procurement_form"):
            c1, c2 = st.columns(2)
            with c1:
                procurement_name = st.text_input("Procurement Name", f["procurement_name"])
                equipment_type = st.text_input("Equipment Type", f["equipment_type"])
                contract_value_cr = st.number_input(
                    "Contract Value (₹ Cr)", value=float(f["contract_value_cr"]), step=0.5
                )
                advance_payment_pct = st.slider(
                    "Advance Payment %", 0, 100, int(f["advance_payment_pct"])
                )
                delivery_timeline_months = st.number_input(
                    "Delivery Timeline (months)",
                    value=float(f["delivery_timeline_months"]),
                    step=1.0,
                )
                warranty_start = st.selectbox(
                    "Warranty Start",
                    ["On Delivery", "On Installation", "On Commissioning"],
                    index=["On Delivery", "On Installation", "On Commissioning"].index(
                        f["warranty_start"]
                    ),
                )
                installation_responsibility = st.selectbox(
                    "Installation Responsibility",
                    ["Buyer", "Vendor"],
                    index=0 if f["installation_responsibility"] == "Buyer" else 1,
                )
            with c2:
                training_included = st.checkbox(
                    "Training Included", value=bool(f["training_included"])
                )
                construction_completion_pct = st.slider(
                    "Construction Completion %",
                    0,
                    100,
                    int(f["construction_completion_pct"]),
                )
                electrical_readiness = st.selectbox(
                    "Electrical Readiness",
                    ["Approved", "Pending", "Not Started"],
                    index=["Approved", "Pending", "Not Started"].index(
                        f["electrical_readiness"]
                    ),
                )
                regulatory_approval_status = st.selectbox(
                    "Regulatory Approval Status",
                    ["Approved", "Pending", "Not Started"],
                    index=["Approved", "Pending", "Not Started"].index(
                        f["regulatory_approval_status"]
                    ),
                )
                technicians_available = st.number_input(
                    "Technicians Available", value=int(f["technicians_available"]), step=1
                )
                technicians_required = st.number_input(
                    "Technicians Required", value=int(f["technicians_required"]), step=1
                )
                historical_delays = st.text_input(
                    "Historical Delays (months, comma-sep)",
                    ", ".join(str(x) for x in f["historical_delays_months"]),
                )

            _, run_col, _ = st.columns(3)
            run_clicked = run_col.form_submit_button(
                "🧠 Run PreMortem", use_container_width=True, type="primary"
            )

        if run_clicked:
            try:
                delays = [
                    float(x.strip())
                    for x in historical_delays.split(",")
                    if x.strip()
                ]
            except ValueError:
                delays = []
            payload = {
                "procurement_name": procurement_name,
                "equipment_type": equipment_type,
                "contract_value_cr": contract_value_cr,
                "advance_payment_pct": advance_payment_pct,
                "delivery_timeline_months": delivery_timeline_months,
                "warranty_start": warranty_start,
                "installation_responsibility": installation_responsibility,
                "training_included": training_included,
                "construction_completion_pct": construction_completion_pct,
                "electrical_readiness": electrical_readiness,
                "regulatory_approval_status": regulatory_approval_status,
                "technicians_available": technicians_available,
                "technicians_required": technicians_required,
                "historical_delays_months": delays,
                "raw_document_text": f.get("raw_document_text"),
                "selected_bid_id": st.session_state.get("selected_demo_bid_id") or "BID-001",
                "selected_quote_id": st.session_state.get("selected_demo_quote_id") or "",
            }
            st.session_state.form = payload
            with st.spinner("Running multi-agent PreMortem review..."):
                try:
                    demo_result = api.analyze_demo_run(payload)
                    st.session_state.report = demo_result["report"]
                    st.session_state.demo_sample_id = demo_result.get("sample_id", "")
                    st.session_state.demo_bid_run_id = (
                        demo_result.get("bid_run", {}).get("run_id", "")
                    )
                    if st.session_state.demo_bid_run_id:
                        try:
                            st.session_state.latest_bid_recommendation = api.get_bid_run_result(
                                st.session_state.demo_bid_run_id
                            )
                            ranked = st.session_state.latest_bid_recommendation.get("ranked_quotes") or []
                            if ranked:
                                st.session_state.selected_rfq_quote_id = str(ranked[0].get("quote_id") or "")
                        except Exception:
                            st.session_state.latest_bid_recommendation = None
                except Exception as e:
                    st.error(f"Analysis failed: {e}")
                    return
            st.success(
                "PreMortem complete. Open the Investigation Board, Debate Room "
                "and Procurement Risk Analysis from the sidebar."
            )
            if st.session_state.get("demo_sample_id"):
                st.caption(
                    "Added current input as "
                    f"{st.session_state.demo_sample_id}; bid run "
                    f"{st.session_state.get('demo_bid_run_id', '')} started."
                )
            elif demo_result.get("quote_ids"):
                st.caption(
                    "Bid run "
                    f"{st.session_state.get('demo_bid_run_id', '')} compared: "
                    + ", ".join(demo_result.get("quote_ids", []))
                )
            _fallback_notice(st.session_state.report)
            _decision_banner(st.session_state.report)


def _default_form():
    try:
        return api.sample_input()
    except Exception:
        return {
            "procurement_name": "MRI System",
            "equipment_type": "MRI Machine",
            "contract_value_cr": 18.0,
            "advance_payment_pct": 60.0,
            "delivery_timeline_months": 4.0,
            "warranty_start": "On Delivery",
            "installation_responsibility": "Buyer",
            "training_included": False,
            "construction_completion_pct": 60.0,
            "electrical_readiness": "Pending",
            "regulatory_approval_status": "Pending",
            "technicians_available": 0,
            "technicians_required": 6,
            "historical_delays_months": [8.0, 11.0, 7.0],
        }


RFQ_ROLES = {
    "management": {"label": "Management", "avatar": "MGMT", "color": "#334155"},
    "doctor": {"label": "Doctor", "avatar": "DR", "color": "#2563eb"},
    "biomedical_engineer": {"label": "Biomedical Engineer", "avatar": "BIO", "color": "#16a34a"},
    "finance": {"label": "Finance", "avatar": "FIN", "color": "#d97706"},
    "procurement_officer": {"label": "Procurement Officer", "avatar": "PROC", "color": "#7c3aed"},
}

RFQ_REQUIREMENT_TEMPLATES = {
    "doctor": [
        ("core mri imaging capability", 1, 30, 4.5),
        ("scan calibration / focus control", 2, 25, 2.0),
        ("patient throughput and workflow fit", 3, 15, 1.2),
        ("ai-based organ marking", 4, 20, 1.8),
        ("ai-based disease artifact detection", 5, 10, 1.0),
    ],
    "biomedical_engineer": [
        ("vendor owns installation and commissioning", 1, 30, 1.5),
        ("service response sla must be contractually stated", 2, 25, 0.8),
        ("spare-parts availability commitment", 3, 20, 1.0),
        ("preventive maintenance schedule included", 4, 15, 0.7),
        ("training and handover documentation included", 5, 10, 0.4),
    ],
    "finance": [
        ("total cost of ownership must be visible", 1, 30, 0.0),
        ("payment milestones tied to commissioning and acceptance", 2, 25, 0.0),
        ("warranty, amc, and cmc costs separated clearly", 3, 20, 0.0),
        ("consumables and software subscriptions disclosed", 4, 15, 0.6),
        ("quoted price benchmarked against acceptable market range", 5, 10, 0.0),
    ],
    "procurement_officer": [
        ("mandatory and negotiable criteria clearly separated", 1, 25, 0.0),
        ("warranty trigger tied to commissioning or acceptance", 2, 25, 0.0),
        ("delivery, installation, and acceptance obligations measurable", 3, 20, 0.0),
        ("vendor exceptions and exclusions must be disclosed", 4, 15, 0.0),
        ("comparable quote format required across vendors", 5, 15, 0.0),
    ],
    "management": [
        ("critical stakeholder needs represented in the rfq", 1, 25, 0.0),
        ("core value requirements are costed or cost-source identified", 2, 25, 0.0),
        ("high-priority risks have mitigation or negotiation conditions", 3, 20, 0.0),
        ("rfq criteria are auditable and comparable", 4, 15, 0.0),
        ("optional features do not distract from core outcomes", 5, 15, 0.0),
    ],
}


def _role_greeting(role: str) -> str:
    greetings = {
        "management": "Decision cockpit ready. I will consolidate each role's value priorities into a publishable RFQ map.",
        "doctor": "Scalpel-sharp RFQ mode on. I will capture clinical must-haves before shiny extras steal the spotlight.",
        "biomedical_engineer": "Commissioning lens on. I will pin down installation, uptime, spares, service, and handover requirements.",
        "finance": "Spreadsheet radar online. I will surface lifecycle cost, payment exposure, and unknown recurring spend.",
        "procurement_officer": "Clause compass ready. I will turn fuzzy wants into comparable, enforceable RFQ criteria.",
    }
    return greetings.get(role, greetings["management"])


def _append_rfq_chat(kind: str, role: str, message: str) -> None:
    if kind == "assistant" and message == _role_greeting(role):
        st.session_state.rfq_chat = [
            msg for msg in st.session_state.rfq_chat
            if msg.get("message") != message
        ]
    st.session_state.rfq_chat.append(
        {"kind": kind, "role": role, "message": message}
    )


def _visible_rfq_requirements(role: str) -> list[dict]:
    if role == "management":
        return st.session_state.rfq_requirements
    return [req for req in st.session_state.rfq_requirements if req.get("role") == role]


def _render_rfq_chat(role: str) -> None:
    st.markdown(
        '<div style="font-size:0.95rem; font-weight:700; color:#334155; margin-bottom:6px;">Role Chat</div>',
        unsafe_allow_html=True,
    )
    chat_box = st.container(height=380)
    with chat_box:
        for msg in st.session_state.rfq_chat[-6:]:
            _render_rfq_chat_message(msg)
        _render_pending_requirement_actions()

    input_version = st.session_state.rfq_chat_input_version
    with st.form(f"rfq_chat_form_{input_version}", clear_on_submit=False):
        file_col, text_col, send_col = st.columns([0.12, 0.76, 0.12])
        with file_col:
            chat_file = st.file_uploader(
                "+",
                type=["pdf", "docx", "txt", "md", "csv"],
                key=f"rfq_chat_file_{input_version}",
            )
        with text_col:
            prompt = st.text_area(
                "Chat message",
                placeholder="Add a requirement, or type 'switch to finance'...",
                height=68,
                label_visibility="collapsed",
                key=f"rfq_chat_text_{input_version}",
            )
        with send_col:
            st.markdown("<div style='height:16px'></div>", unsafe_allow_html=True)
            send_clicked = st.form_submit_button("➤", use_container_width=True)
    if not send_clicked:
        return
    prompt = _chat_prompt_with_file(prompt, chat_file)
    if not prompt:
        return
    new_role = _detect_role_switch(prompt)
    if new_role:
        st.session_state.rfq_role = new_role
        st.session_state.rfq_pending_requirement = None
        _append_rfq_chat("user", role, prompt)
        _append_rfq_chat("assistant", new_role, _role_greeting(new_role))
        st.session_state.rfq_chat_input_version += 1
        st.rerun()

    active_role = st.session_state.rfq_role
    _append_rfq_chat("user", active_role, prompt)
    _handle_rfq_chat_prompt(prompt, active_role)
    st.session_state.rfq_chat_input_version += 1
    st.rerun()


def _render_rfq_chat_message(msg: dict) -> None:
    role = msg.get("role", "management")
    meta = RFQ_ROLES.get(role, RFQ_ROLES["management"])
    is_user = msg.get("kind") == "user"
    color = meta["color"] if is_user else "#0f172a"
    avatar = meta["avatar"] if is_user else "AI"
    label = meta["label"] if is_user else "RFQ Guidance Agent"
    align = "right" if is_user else "left"
    bg = "#f8fafc" if is_user else "#ffffff"
    st.markdown(
        f"""
        <div style="display:flex; justify-content:{'flex-end' if align == 'right' else 'flex-start'}; margin:5px 0;">
          <div style="max-width:88%; border:1px solid #e2e8f0; border-radius:7px; padding:7px 8px; background:{bg};">
            <span title="{label}" style="display:inline-block; background:{color}; color:white; border-radius:999px; padding:3px 8px; font-size:0.72rem; font-weight:700; margin-right:6px;">{avatar}</span>
            <span style="color:#0f172a; font-size:0.88rem;">{msg.get('message', '')}</span>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def _chat_prompt_with_file(prompt: str, uploaded_file) -> str:
    text = (prompt or "").strip()
    if uploaded_file is None:
        return text
    try:
        parsed = api.upload(uploaded_file.name, uploaded_file.getvalue())
        preview = str(parsed.get("text_preview") or "").strip()
        file_context = (
            f"Uploaded file {uploaded_file.name}. "
            f"Use this as RFQ input context: {preview[:1200]}"
        )
    except Exception as exc:
        file_context = f"Uploaded file {uploaded_file.name}, but parsing failed: {exc}"
    if text:
        return f"{text}\n\n{file_context}"
    return file_context


def _detect_role_switch(text: str) -> str | None:
    lower = text.lower()
    role_aliases = {
        "management": ["management", "manager", "executive"],
        "doctor": ["doctor", "clinical", "radiologist"],
        "biomedical_engineer": ["biomedical", "engineer", "service"],
        "finance": ["finance", "financial", "cost"],
        "procurement_officer": ["procurement", "buyer", "contract"],
    }
    if not any(word in lower for word in ("switch", "change", "i am", "i'm", "as ")):
        return None
    for role, aliases in role_aliases.items():
        if any(alias in lower for alias in aliases):
            return role
    return None


def _handle_rfq_chat_prompt(text: str, role: str) -> None:
    commands = _split_rfq_chat_commands(text)
    if len(commands) > 1:
        for command in commands:
            _handle_rfq_chat_prompt(command, role)
        return

    lower = text.lower().strip()
    if _is_greeting(lower):
        _append_rfq_chat(
            "assistant",
            role,
            "Hello. Tell me a requirement for this role, or say which known RFQ requirement you want to add.",
        )
        return

    if _is_remove_requirement_command(lower):
        removed = _remove_requirement_from_chat(text)
        st.session_state.rfq_pending_requirement = None
        _append_rfq_chat(
            "assistant",
            role,
            (
                f"Removed requirement: {removed}."
                if removed
                else "I could not find a matching requirement to remove. Try the exact requirement text or edit the table."
            ),
        )
        return

    budget_update = _extract_budget_cr(lower)
    if budget_update is not None:
        if budget_update < 0:
            _append_rfq_chat("assistant", role, "Budget cannot be negative.")
            return
        st.session_state.rfq_budget_cr = budget_update
        st.session_state.rfq_pending_requirement = None
        _append_rfq_chat(
            "assistant",
            role,
            f"Budget updated to ₹{budget_update:g} Cr.",
        )
        return

    requirement, matched = _requirement_from_chat(text, role)
    if matched:
        st.session_state.rfq_pending_requirement = requirement
        _append_rfq_chat(
            "assistant",
            role,
            (
                "I found a matching requirement. Add it? "
                f"{requirement['requirement']} | priority {requirement['priority_rank']} | "
                f"value {requirement['perspective_value_pct']}% | "
                f"cost {_format_cost(requirement.get('estimated_cost_cr'))}."
            ),
        )
        return

    missing_fields = _missing_custom_requirement_fields(text)
    if not missing_fields:
        st.session_state.rfq_pending_requirement = requirement
        _append_rfq_chat(
            "assistant",
            role,
            (
                "This looks like a custom requirement with enough detail. Add it? "
                f"{requirement['requirement']} | priority {requirement['priority_rank']} | "
                f"value {requirement['perspective_value_pct']}% | "
                f"cost {_format_cost(requirement.get('estimated_cost_cr'))}."
            ),
        )
        return

    if any(token in lower for token in ("priority", "value", "%", "cost", "cr", "crore", "unknown cost")):
        st.session_state.rfq_pending_requirement = None
        _append_rfq_chat(
            "assistant",
            role,
            f"I need {', '.join(missing_fields)} before I can draft this requirement.",
        )
        return

    st.session_state.rfq_pending_requirement = None
    _append_rfq_chat(
        "assistant",
        role,
        (
            "I do not want to add that automatically. If this is a custom requirement, "
            "please include priority, value %, and cost, or mention one of the known requirements."
        ),
    )


def _render_pending_requirement_actions() -> None:
    pending = st.session_state.rfq_pending_requirement
    if not pending:
        return
    new_total = _known_requirement_cost() + float(pending.get("estimated_cost_cr") or 0)
    budget = float(st.session_state.get("rfq_budget_cr") or 0)
    exceeds_budget = budget > 0 and new_total > budget
    role_value_total = _role_value_total(str(pending.get("role") or ""))
    pending_value = float(pending.get("perspective_value_pct") or 0)
    new_role_value_total = role_value_total + pending_value
    exceeds_role_value = new_role_value_total > 100
    validation_errors = _validate_requirement(pending)
    proposed_requirements = st.session_state.rfq_requirements + [pending]
    rfq_errors = _validate_rfq_requirements(
        proposed_requirements,
        float(st.session_state.get("rfq_budget_cr") or 0),
    )
    validation_errors.extend(error for error in rfq_errors if error not in validation_errors)
    if exceeds_budget:
        st.warning(
            f"Adding this will exceed budget: known cost becomes ₹{new_total:.1f} Cr "
            f"against budget ₹{budget:.1f} Cr."
        )
    if exceeds_role_value:
        role_label = RFQ_ROLES.get(str(pending.get("role")), {}).get("label", "this role")
        st.warning(
            f"Adding this will exceed {role_label} value coverage: "
            f"{role_value_total:.0f}% + {pending_value:.0f}% = {new_role_value_total:.0f}%. "
            "Reduce value % or adjust existing requirements so the role total stays within 100%."
        )
    for error in validation_errors:
        st.warning(error)
    c1, c2, c3 = st.columns(3)
    with c1:
        if st.button("Yes, add", key="rfq_add_pending", use_container_width=True):
            if validation_errors:
                _append_rfq_chat(
                    "assistant",
                    pending["role"],
                    "I did not add it because one or more fields are invalid. Please revise the requirement.",
                )
                st.session_state.rfq_pending_requirement = None
                st.rerun()
            if exceeds_role_value:
                _append_rfq_chat(
                    "assistant",
                    pending["role"],
                    (
                        "I did not add it because this role's value total would exceed 100%. "
                        "Reduce the new value % or edit existing requirements first."
                    ),
                )
                st.session_state.rfq_pending_requirement = None
                st.rerun()
            if exceeds_budget:
                _append_rfq_chat(
                    "assistant",
                    pending["role"],
                    "I did not add it because it exceeds the current budget. Increase budget in chat or revise the cost.",
                )
                st.session_state.rfq_pending_requirement = None
                st.rerun()
            st.session_state.rfq_requirements.append(pending)
            _append_rfq_chat("assistant", pending["role"], "Added to the RFQ requirement table.")
            st.session_state.rfq_pending_requirement = None
            st.rerun()
    with c2:
        if st.button("No", key="rfq_reject_pending", use_container_width=True):
            _append_rfq_chat("assistant", pending["role"], "Okay, I did not add it.")
            st.session_state.rfq_pending_requirement = None
            st.rerun()
    with c3:
        if st.button("Chat further", key="rfq_discuss_pending", use_container_width=True):
            _append_rfq_chat(
                "assistant",
                pending["role"],
                "Tell me what to change: priority, value %, cost, or requirement wording.",
            )
            st.rerun()


def _requirement_from_chat(text: str, role: str) -> tuple[dict, bool]:
    lower = text.lower()
    templates = [
        (candidate_role, *template)
        for candidate_role, role_templates in RFQ_REQUIREMENT_TEMPLATES.items()
        for template in role_templates
    ]
    best_template = None
    best_hits = 0
    for template_role, label, priority, value, cost in templates:
        hits = sum(1 for token in label.split() if len(token) > 3 and token in lower)
        if hits > best_hits:
            best_hits = hits
            best_template = (template_role, label, priority, value, cost)
    if best_template and best_hits >= 2:
        template_role, label, priority, value, cost = best_template
        requirement = label.capitalize()
        user_priority = _extract_number_after(lower, "priority")
        user_value = _extract_percent(lower)
        user_cost = _extract_cost_cr(lower)
        cost_unknown = _has_unknown_cost(lower)
        priority = user_priority if user_priority is not None else priority
        value = user_value if user_value is not None else value
        cost = user_cost if user_cost is not None else cost
        if cost_unknown and user_cost is None:
            cost = None
        cost_confidence = "unknown"
        cost_source = "user provided" if user_cost is not None else f"{template_role} template"
        matched = True
    else:
        template_role = _detect_requirement_perspective(lower, role)
        requirement = text.strip().rstrip(".")
        priority = _extract_number_after(lower, "priority") or _next_role_priority(template_role)
        value = _extract_percent(lower) or max(5, 30 - ((priority - 1) * 5))
        cost = None if _has_unknown_cost(lower) else _extract_cost_cr(lower)
        cost_confidence = "unknown"
        cost_source = "unknown" if cost is None else "free text"
        matched = False
    return {
        "id": f"REQ-{len(st.session_state.rfq_requirements) + 1:03d}",
        "entered_by_role": role,
        "role": template_role,
        "requirement": requirement,
        "priority_rank": priority,
        "perspective_value_pct": value,
        "estimated_cost_cr": cost,
        "cost_confidence": cost_confidence,
        "cost_source": cost_source,
        "notes": "Mapped from chat input.",
    }, matched


def _detect_requirement_perspective(text: str, fallback_role: str) -> str:
    keyword_map = {
        "doctor": [
            "scan", "imaging", "image", "organ", "disease", "diagnostic",
            "patient", "clinical", "radiology", "calibration", "marking",
            "detection", "fetection", "mri", "artifact", "ai", "infection",
            "infected", "tissue", "tisssue", "tumor", "lesion", "pathology",
        ],
        "biomedical_engineer": [
            "installation", "commissioning", "uptime", "spare", "parts",
            "service", "sla", "maintenance", "training", "handover",
        ],
        "finance": [
            "cost", "budget", "payment", "milestone", "tco", "lifecycle",
            "subscription", "amc", "cmc", "price",
        ],
        "procurement_officer": [
            "warranty", "vendor", "obligation", "acceptance", "criteria",
            "exception", "exclusion", "quote", "comparable", "rfq",
        ],
        "management": [
            "stakeholder", "alignment", "approval", "governance", "publish",
            "decision", "value coverage",
        ],
    }
    scores = {
        role: sum(1 for keyword in keywords if keyword in text)
        for role, keywords in keyword_map.items()
    }
    if scores["doctor"] > 0 and any(
        keyword in text
        for keyword in (
            "ai", "organ", "infection", "infected", "tissue", "tisssue",
            "detection", "fetection", "disease", "diagnostic", "clinical",
            "scan", "mri",
        )
    ):
        return "doctor"
    best_role = max(scores, key=scores.get)
    if scores[best_role] <= 0:
        return fallback_role
    return best_role


def _split_rfq_chat_commands(text: str) -> list[str]:
    import re

    normalized = text.strip()
    if not normalized:
        return []
    parts = [
        part.strip()
        for part in re.split(
            r"(?<=[.!?])\s+(?=(?:add|remove|delete|set|change|update|increase|incresae|reduce)\b)",
            normalized,
            flags=re.I,
        )
        if part.strip()
    ]
    return parts or [normalized]


def _is_remove_requirement_command(text: str) -> bool:
    return text.startswith(("remove ", "delete "))


def _remove_requirement_from_chat(text: str) -> str | None:
    import re

    target = re.sub(r"^\s*(remove|delete)\s+", "", text, flags=re.I).strip()
    target_norm = _normalize_requirement_text(target)
    if not target_norm:
        return None
    target_words = set(target_norm.split())
    best_index = None
    best_score = 0
    for idx, req in enumerate(st.session_state.rfq_requirements):
        req_norm = _normalize_requirement_text(str(req.get("requirement") or ""))
        req_words = set(req_norm.split())
        if not req_words:
            continue
        score = len(target_words & req_words)
        if target_norm in req_norm or req_norm in target_norm:
            score += 3
        if score > best_score:
            best_score = score
            best_index = idx
    if best_index is None or best_score <= 0:
        return None
    removed = st.session_state.rfq_requirements.pop(best_index)
    return str(removed.get("requirement") or removed.get("id") or "selected requirement")


def _is_greeting(text: str) -> bool:
    import re

    normalized = re.sub(r"[^a-z\s]", "", text.lower()).strip()
    normalized = re.sub(r"(.)\1{2,}", r"\1\1", normalized)
    greetings = {
        "hi",
        "hii",
        "hello",
        "helo",
        "helllo",
        "hey",
        "heyy",
        "good morning",
        "good afternoon",
        "good evening",
    }
    if normalized in greetings:
        return True
    return normalized.startswith(("hello ", "helo ", "hey ", "hi "))


def _has_custom_requirement_details(text: str) -> bool:
    return not _missing_custom_requirement_fields(text)


def _missing_custom_requirement_fields(text: str) -> list[str]:
    lower = text.lower()
    missing = []
    if "priority" not in lower and "rank" not in lower:
        missing.append("priority")
    if "value" not in lower and "%" not in lower:
        missing.append("value %")
    if not any(token in lower for token in ("cost", "cr", "crore")) and not _has_unknown_cost(lower):
        missing.append("cost or unknown-cost status")
    return missing


def _has_unknown_cost(text: str) -> bool:
    lower = text.lower()
    return any(
        phrase in lower
        for phrase in (
            "unknown cost",
            "cost unknown",
            "cost is unknown",
            "cost not known",
            "unknown-cost",
        )
    )


def _extract_number_after(text: str, keyword: str) -> int | None:
    import re

    match = re.search(rf"{keyword}[^\d]{{0,10}}(\d+)", text)
    if not match:
        return None
    return int(match.group(1))


def _extract_percent(text: str) -> float | None:
    import re

    match = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
    if match:
        return float(match.group(1))
    match = re.search(r"value[^\d]{0,10}(\d+(?:\.\d+)?)", text)
    if match:
        return float(match.group(1))
    return None


def _extract_cost_cr(text: str) -> float | None:
    import re

    match = re.search(r"(?:feature cost|requirement cost|cost|budget|₹|rs\.?)[^\d]{0,16}(\d+(?:\.\d+)?)\s*(?:cr|crore)?", text)
    if match:
        return float(match.group(1))
    match = re.search(r"(\d+(?:\.\d+)?)\s*(?:cr|crore)", text)
    if match:
        return float(match.group(1))
    return None


def _extract_budget_cr(text: str) -> float | None:
    import re

    # Plain "budget 20 crore" inside a requirement means feature cost.
    # The RFQ-level budget changes only when the user explicitly says so.
    match = re.search(
        r"(?:overall|rfq|total)\s+budget[^\d]{0,20}(\d+(?:\.\d+)?)\s*(?:cr|crore)?",
        text,
    )
    if match:
        return float(match.group(1))
    match = re.search(
        r"(?:set|change|update|increase|incresae|reduce)\s+(?:the\s+)?(?:overall\s+|rfq\s+|total\s+)?budget[^\d]{0,20}(\d+(?:\.\d+)?)\s*(?:cr|crore)?",
        text,
    )
    if match:
        return float(match.group(1))
    return None


def _known_requirement_cost() -> float:
    return sum(
        float(req.get("estimated_cost_cr") or 0)
        for req in st.session_state.rfq_requirements
    )


def _role_value_total(role: str) -> float:
    return sum(
        float(req.get("perspective_value_pct") or 0)
        for req in st.session_state.rfq_requirements
        if req.get("role") == role
    )


def _validate_requirement(req: dict) -> list[str]:
    errors: list[str] = []
    label = str(req.get("requirement") or "Requirement").strip() or "Requirement"
    priority = int(req.get("priority_rank") or 0)
    value = float(req.get("perspective_value_pct") or 0)
    cost = req.get("estimated_cost_cr")
    if not label:
        errors.append("Requirement text cannot be empty.")
    if priority < 1:
        errors.append(f"{label}: priority must be 1 or higher.")
    if priority > 20:
        errors.append(f"{label}: priority {priority} is unusually high. Keep demo priorities within 1-20.")
    if value < 0:
        errors.append(f"{label}: value % cannot be negative.")
    if value > 100:
        errors.append(f"{label}: value % cannot exceed 100 for one requirement.")
    if cost not in (None, "") and float(cost or 0) < 0:
        errors.append(f"{label}: cost cannot be negative.")
    return errors


def _validate_rfq_requirements(requirements: list[dict], budget_cr: float) -> list[str]:
    errors: list[str] = []
    for req in requirements:
        errors.extend(_validate_requirement(req))
    for role, info in RFQ_ROLES.items():
        total = sum(
            float(req.get("perspective_value_pct") or 0)
            for req in requirements
            if req.get("role") == role
        )
        if total > 100:
            errors.append(f"{info['label']} value coverage exceeds 100% ({total:.0f}%).")
    known_cost = sum(float(req.get("estimated_cost_cr") or 0) for req in requirements)
    if budget_cr < 0:
        errors.append("RFQ budget cannot be negative.")
    if budget_cr > 0 and known_cost > budget_cr:
        errors.append(f"Known requirement cost ₹{known_cost:.1f} Cr exceeds budget ₹{budget_cr:.1f} Cr.")
    duplicate = _find_duplicate_requirement(requirements)
    if duplicate:
        errors.append(f"Possible duplicate requirement: {duplicate}.")
    return errors


def _publish_warnings(requirements: list[dict]) -> list[str]:
    warnings: list[str] = []
    if not requirements:
        warnings.append("Add at least one requirement before publishing.")
        return warnings
    missing_roles = [
        info["label"]
        for role, info in RFQ_ROLES.items()
        if not any(req.get("role") == role for req in requirements)
    ]
    if missing_roles:
        warnings.append(f"No requirements yet for: {', '.join(missing_roles)}.")
    low_value_roles = [
        info["label"]
        for role, info in RFQ_ROLES.items()
        if 0 < _role_value_total_from(requirements, role) < 25
    ]
    if low_value_roles:
        warnings.append(f"Low value coverage for: {', '.join(low_value_roles)}.")
    return warnings


def _role_value_total_from(requirements: list[dict], role: str) -> float:
    return sum(
        float(req.get("perspective_value_pct") or 0)
        for req in requirements
        if req.get("role") == role
    )


def _find_duplicate_requirement(requirements: list[dict]) -> str | None:
    seen: dict[tuple[str, str], str] = {}
    for req in requirements:
        role = str(req.get("role") or "")
        normalized = _normalize_requirement_text(str(req.get("requirement") or ""))
        if not normalized:
            continue
        key = (role, normalized)
        if key in seen:
            return str(req.get("requirement") or seen[key])
        seen[key] = str(req.get("requirement") or "")
    return None


def _normalize_requirement_text(text: str) -> str:
    import re

    words = re.sub(r"[^a-z0-9\s]", " ", text.lower()).split()
    stop = {"the", "and", "or", "must", "be", "is", "are", "with", "for", "to"}
    return " ".join(word for word in words if word not in stop)


def _next_role_priority(role: str) -> int:
    existing = [
        int(req.get("priority_rank") or 0)
        for req in st.session_state.rfq_requirements
        if req.get("role") == role
    ]
    return max(existing or [0]) + 1


def _load_example_requirements() -> None:
    st.session_state.rfq_requirements = []
    for role, templates in RFQ_REQUIREMENT_TEMPLATES.items():
        for label, priority, value, cost in templates[:3]:
            st.session_state.rfq_requirements.append(
                {
                    "id": f"REQ-{len(st.session_state.rfq_requirements) + 1:03d}",
                    "entered_by_role": role,
                    "role": role,
                    "requirement": label.capitalize(),
                    "priority_rank": priority,
                    "perspective_value_pct": value,
                    "estimated_cost_cr": cost,
                    "cost_confidence": "unknown",
                    "cost_source": f"{role} template",
                    "notes": "Seeded demo requirement.",
                }
            )
    st.session_state.rfq_chat = []
    _append_rfq_chat("assistant", st.session_state.rfq_role, _role_greeting(st.session_state.rfq_role))


def _render_rfq_requirement_table(role: str) -> None:
    st.markdown("### Requirements")
    roles = list(RFQ_ROLES.keys()) if role == "management" else [role]
    for group_role in roles:
        rows = [
            req for req in st.session_state.rfq_requirements
            if req.get("role") == group_role
        ]
        if not rows:
            continue
        label = RFQ_ROLES[group_role]["label"]
        total_value = sum(float(row.get("perspective_value_pct") or 0) for row in rows)
        with st.expander(f"{label} · {len(rows)} requirements · {total_value:.0f}% value", expanded=group_role == role or role == "management"):
            rows = sorted(rows, key=lambda item: int(item.get("priority_rank") or 99))
            table_signature = "_".join(str(row.get("id", "")) for row in rows)
            edited_rows = st.data_editor(
                [
                    {
                        "ID": row.get("id"),
                        "Role": _role_display_name(str(row.get("role") or "")),
                        "Priority": row.get("priority_rank"),
                        "Requirement": row.get("requirement"),
                        "Value %": row.get("perspective_value_pct"),
                        "Cost ₹ Cr": row.get("estimated_cost_cr") or "",
                        "Confidence": row.get("cost_confidence"),
                        "Source": row.get("cost_source"),
                    }
                    for row in rows
                ],
                use_container_width=True,
                hide_index=True,
                disabled=["ID", "Confidence", "Source"],
                column_config={
                    "Role": st.column_config.SelectboxColumn(
                        "Role",
                        options=[info["label"] for info in RFQ_ROLES.values()],
                    ),
                    "Priority": st.column_config.NumberColumn("Priority", min_value=1, max_value=20, step=1),
                    "Value %": st.column_config.NumberColumn("Value %", min_value=0.0, max_value=100.0, step=1.0),
                    "Cost ₹ Cr": st.column_config.NumberColumn("Cost ₹ Cr", min_value=0.0, step=0.1),
                },
                key=f"rfq_table_{group_role}_{table_signature}",
            )
            _sync_edited_rfq_rows(edited_rows)


def _sync_edited_rfq_rows(edited_rows: list[dict]) -> None:
    current = [dict(row) for row in st.session_state.rfq_requirements]
    by_id = {row.get("id"): row for row in current}
    for edited in edited_rows:
        req = by_id.get(edited.get("ID"))
        if not req:
            continue
        req["role"] = _role_key_from_display(str(edited.get("Role") or req.get("role") or ""))
        req["priority_rank"] = _safe_int(edited.get("Priority"), req.get("priority_rank", 1))
        req["requirement"] = str(edited.get("Requirement") or req.get("requirement") or "")
        req["perspective_value_pct"] = _safe_float(
            edited.get("Value %"),
            req.get("perspective_value_pct", 0),
        )
        req["estimated_cost_cr"] = _safe_float(
            edited.get("Cost ₹ Cr"),
            req.get("estimated_cost_cr", 0),
        )
        req["cost_confidence"] = "unknown" if req["estimated_cost_cr"] in (None, 0, 0.0) else req.get("cost_confidence", "medium")
    errors = _validate_rfq_requirements(current, float(st.session_state.get("rfq_budget_cr") or 0))
    if errors:
        st.error("Table edit not applied: " + " ".join(errors[:3]))
        return
    st.session_state.rfq_requirements = current


def _role_display_name(role: str) -> str:
    return RFQ_ROLES.get(role, {}).get("label", role)


def _role_key_from_display(value: str) -> str:
    for role, info in RFQ_ROLES.items():
        if value == role or value == info.get("label"):
            return role
    return value


def _safe_int(value, fallback: int) -> int:
    try:
        return int(value)
    except Exception:
        return int(fallback or 0)


def _safe_float(value, fallback: float) -> float:
    try:
        if value in ("", None):
            return 0.0
        return float(value)
    except Exception:
        return float(fallback or 0)


def _render_rfq_kpis(items: list[tuple[str, object]]) -> None:
    cols = st.columns(len(items))
    for col, (label, value) in zip(cols, items):
        with col:
            st.markdown(
                f"""
                <div style="border:1px solid #e2e8f0; border-radius:6px; padding:5px 8px; background:#ffffff;">
                  <div style="font-size:0.62rem; color:#64748b; font-weight:700; text-transform:uppercase;">{label}</div>
                  <div style="font-size:0.9rem; color:#0f172a; font-weight:800; margin-top:1px;">{value}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )


def _format_cost(cost) -> str:
    if cost in (None, "", 0, 0.0):
        return "unknown cost"
    return f"₹{float(cost):g} Cr"


def _quote_id_from_filename(filename: str) -> tuple[str, str]:
    match = re.search(r"(BID-\d{3,})-Q(\d{2,})", filename or "", flags=re.I)
    if not match:
        return "", ""
    bid_id = match.group(1).upper()
    return bid_id, f"{bid_id}-Q{match.group(2)}"


def _top_two_recommended_quotes() -> list[dict]:
    rec = st.session_state.get("latest_bid_recommendation") or {}
    ranked = list(rec.get("ranked_quotes") or [])
    selected_quote_id = st.session_state.get("selected_demo_quote_id") or ""
    if not selected_quote_id:
        return ranked[:2]
    selected = next(
        (quote for quote in ranked if str(quote.get("quote_id") or "") == selected_quote_id),
        None,
    )
    if not selected:
        return ranked[:2]
    others = [
        quote for quote in ranked
        if str(quote.get("quote_id") or "") != selected_quote_id
    ]
    return [selected] + others[:1]


def _selected_rfq_quote() -> dict | None:
    quotes = _top_two_recommended_quotes()
    if not quotes:
        return None
    selected_id = (
        st.session_state.get("rfq_quote_overlay_selector")
        or st.session_state.get("selected_rfq_quote_id")
        or str(quotes[0].get("quote_id") or "")
    )
    for quote in quotes:
        if str(quote.get("quote_id") or "") == selected_id:
            return quote
    return quotes[0]


def _quote_cost_cr(quote: dict | None) -> float | None:
    if not quote:
        return None
    direct = quote.get("contract_value_cr") or quote.get("quoted_price_cr")
    if direct not in (None, ""):
        try:
            return float(direct)
        except Exception:
            pass
    text = " ".join(
        str(item)
        for item in (
            quote.get("recommendation", ""),
            quote.get("rationale", ""),
            " ".join(str(finding) for finding in quote.get("findings") or []),
        )
    )
    match = re.search(r"(?:INR|₹)\s*(\d+(?:\.\d+)?)\s*(?:Cr|crore)", text, flags=re.I)
    if match:
        return float(match.group(1))
    curated_costs = {
        "BID-001-Q06": 18.90,
        "BID-001-Q07": 17.60,
    }
    quote_id = str(quote.get("quote_id") or "")
    if quote_id in curated_costs:
        return curated_costs[quote_id]
    return None


def _quote_fit_overlay(quote: dict | None) -> dict | None:
    if not quote:
        return None
    text = " ".join(
        str(item).lower()
        for item in (
            quote.get("recommendation", ""),
            " ".join(str(finding) for finding in quote.get("findings") or []),
        )
    )
    risk_score = float(quote.get("risk_score") or 75)
    base = max(20.0, min(90.0, 100.0 - risk_score))
    role_values = {
        "management": base + 10,
        "doctor": base,
        "biomedical_engineer": base,
        "finance": base,
        "procurement_officer": base,
    }
    if any(token in text for token in ("training", "service", "sla", "local service", "spare")):
        role_values["biomedical_engineer"] += 25
    if any(token in text for token in ("bank guarantee", "retention", "reduced advance", "advance")):
        role_values["finance"] += 20
    if any(token in text for token in ("warranty", "acceptance", "commissioning", "installation")):
        role_values["procurement_officer"] += 20
    if any(token in text for token in ("ai", "organ", "infection", "clinical", "mri", "diagnostic")):
        role_values["doctor"] += 25
    if any(token in text for token in ("do not award", "conflict", "missing", "unclear", "not included")):
        role_values = {key: value - 10 for key, value in role_values.items()}
    return {
        "quote_id": quote.get("quote_id", "Selected quote"),
        "role_values": {
            key: max(0.0, min(100.0, value))
            for key, value in role_values.items()
        },
    }


def _render_top_quote_options() -> None:
    quotes = _top_two_recommended_quotes()
    if not quotes:
        st.caption("Run Screen 2 to show top vendor options here.")
        return
    st.markdown("#### Top Vendor Options")
    options = [str(quote.get("quote_id") or f"Quote {idx}") for idx, quote in enumerate(quotes, start=1)]
    current = st.session_state.get("selected_rfq_quote_id") or options[0]
    selected = st.radio(
        "Select quote overlay",
        options,
        index=options.index(current) if current in options else 0,
        horizontal=True,
        label_visibility="collapsed",
        key="rfq_quote_overlay_selector",
    )
    st.session_state.selected_rfq_quote_id = selected
    cols = st.columns(len(quotes))
    for col, quote in zip(cols, quotes):
        with col:
            is_selected = selected == str(quote.get("quote_id") or "")
            border = "#7f1d1d" if is_selected else "#e2e8f0"
            st.markdown(
                f"""
                <div style="border:1px solid {border}; border-radius:6px; padding:8px 10px; background:#ffffff;">
                  <div style="font-size:0.78rem; font-weight:800; color:#0f172a;">{quote.get('quote_id', 'Quote')}</div>
                  <div style="font-size:0.74rem; color:#475569;">Risk {float(quote.get('risk_score') or 0):.0f} · {quote.get('risk_level', '')}</div>
                  <div style="font-size:0.74rem; color:#7f1d1d; font-weight:700;">Cost {_format_cost(_quote_cost_cr(quote))}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )
    selected_quote = next(
        (quote for quote in quotes if str(quote.get("quote_id") or "") == selected),
        quotes[0],
    )
    if st.button("Suggest Negotiation Change", use_container_width=True):
        suggestion = _negotiation_change_suggestion(selected_quote)
        _append_rfq_chat("assistant", st.session_state.rfq_role, suggestion)
        st.rerun()


def _negotiation_change_suggestion(quote: dict) -> str:
    quote_id = str(quote.get("quote_id") or "selected quote")
    cost = _quote_cost_cr(quote)
    if quote_id == "BID-001-Q06":
        return (
            "Negotiation suggestion for BID-001-Q06: keep AI-based organ coloring "
            "and AI-based infected tissue detection as accepted clinical value items, "
            "but ask ApexCura to apply the stated ₹0.20 Cr discount and lock warranty "
            "start to commissioning/acceptance. This preserves higher clinical value "
            f"while bringing quote cost from {_format_cost(cost)} to about ₹18.7 Cr."
        )
    text = " ".join(
        str(item).lower()
        for item in (
            quote.get("recommendation", ""),
            " ".join(str(finding) for finding in quote.get("findings") or []),
        )
    )
    asks = []
    if "ai" not in text or "not included" in text:
        asks.append("add AI-based organ coloring and infected tissue detection as priced options")
    if "warranty" in text:
        asks.append("move warranty start to commissioning/acceptance")
    if "service" in text or "sla" in text:
        asks.append("add resolution-time, spare-parts, uptime, and service-credit SLA terms")
    if "advance" in text:
        asks.append("reduce advance payment or secure it with bank guarantee/retention")
    if not asks:
        asks.append("convert all high-value RFQ gaps into measurable acceptance conditions")
    return (
        f"Negotiation suggestion for {quote_id}: ask the vendor to "
        + "; ".join(asks[:4])
        + ". Keep this as a negotiation condition rather than changing the RFQ automatically."
    )


def _rfq_value_area_pct(requirements: list[dict]) -> float:
    roles = list(RFQ_ROLES.keys())
    values = []
    for role in roles:
        role_value = sum(
            float(req.get("perspective_value_pct") or 0)
            for req in requirements
            if req.get("role") == role
        )
        values.append(min(100.0, role_value))
    if len(values) < 3:
        return 0.0
    theta = (2 * math.pi) / len(values)
    area = 0.0
    max_area = 0.0
    for idx, value in enumerate(values):
        area += value * values[(idx + 1) % len(values)] * math.sin(theta) / 2
        max_area += 100 * 100 * math.sin(theta) / 2
    if max_area <= 0:
        return 0.0
    return max(0.0, min(100.0, (area / max_area) * 100))


# --------------------------------------------------------------------------- #
# Screen 1 - RFQ Intake
# --------------------------------------------------------------------------- #
def screen_rfq_intake():
    base = st.session_state.form or _default_form()
    _load_latest_bid_recommendation_for_rfq()
    if "rfq_budget_initialized" not in st.session_state:
        st.session_state.rfq_budget_cr = float(base.get("contract_value_cr", 18.0))
        st.session_state.rfq_budget_initialized = True
    if not st.session_state.rfq_requirements:
        _load_example_requirements()

    title_col, equipment_col, role_col = st.columns([3.2, 0.85, 0.85])
    with title_col:
        rfq_name = st.text_input(
            "RFQ Name",
            str(base.get("procurement_name", "MRI System")),
            label_visibility="collapsed",
        )
    with equipment_col:
        equipment_type = st.text_input(
            "Equipment / Service Type",
            str(base.get("equipment_type", "MRI Machine")),
            label_visibility="collapsed",
            placeholder="Equipment / Service Type",
        )
    with role_col:
        role = st.selectbox(
            "Active Role",
            list(RFQ_ROLES.keys()),
            index=list(RFQ_ROLES.keys()).index(st.session_state.rfq_role),
            format_func=lambda key: f"Role: {RFQ_ROLES[key]['label']}",
            label_visibility="collapsed",
        )
    if role != st.session_state.rfq_role:
        st.session_state.rfq_role = role
        _append_rfq_chat("assistant", role, _role_greeting(role))

    if not st.session_state.rfq_chat:
        _append_rfq_chat("assistant", role, _role_greeting(role))

    visible_requirements = _visible_rfq_requirements(role)
    total_value = _rfq_value_area_pct(st.session_state.rfq_requirements)
    known_cost = _known_requirement_cost()
    unknown_cost = sum(1 for req in st.session_state.rfq_requirements if not req.get("estimated_cost_cr"))
    selected_quote = _selected_rfq_quote()
    selected_quote_overlay = _quote_fit_overlay(selected_quote)
    selected_quote_cost = _quote_cost_cr(selected_quote)

    chart_col, cost_col, chat_col = st.columns([1.35, 0.45, 1.2])
    with chart_col:
        st.plotly_chart(
            charts.rfq_radial_requirement_map(
                st.session_state.rfq_requirements,
                quote_fit=selected_quote_overlay,
            ),
            use_container_width=True,
        )
        _render_top_quote_options()
    with cost_col:
        st.plotly_chart(
            charts.rfq_cost_confidence_meter(
                st.session_state.rfq_requirements,
                float(st.session_state.rfq_budget_cr),
                quote_cost_cr=selected_quote_cost,
            ),
            use_container_width=True,
        )
    with chat_col:
        _render_rfq_chat(role)

    st.divider()
    left, right = st.columns([1, 1])
    with left:
        if st.button("Load Default Requirements", use_container_width=True):
            _load_example_requirements()
            st.rerun()
    with right:
        if st.button("Publish", type="primary", use_container_width=True):
            publish_payload = {
                "rfq_id": str((st.session_state.published_rfq or {}).get("rfq_id") or ""),
                "procurement_name": rfq_name,
                "equipment_type": equipment_type,
                "budget_cr": float(st.session_state.rfq_budget_cr),
                "requirements": st.session_state.rfq_requirements,
                "minimum_criteria": [
                    req["requirement"]
                    for req in st.session_state.rfq_requirements
                    if int(req.get("priority_rank") or 99) <= 2
                ],
                "negotiable_criteria": [
                    req["requirement"]
                    for req in st.session_state.rfq_requirements
                    if int(req.get("priority_rank") or 99) > 2
                ],
            }
            publish_errors = _validate_rfq_requirements(
                st.session_state.rfq_requirements,
                float(st.session_state.rfq_budget_cr),
            )
            publish_warnings = _publish_warnings(st.session_state.rfq_requirements)
            if publish_errors or publish_warnings:
                for error in publish_errors:
                    st.error(error)
                for warning in publish_warnings:
                    st.warning(warning)
                if publish_errors:
                    st.stop()
            try:
                publish_result = api.publish_rfq(publish_payload)
            except Exception as exc:
                st.error(f"RFQ publish failed: {exc}")
                st.stop()
            st.session_state.published_rfq = {
                **publish_payload,
                "rfq_id": publish_result.get("rfq_id", ""),
                "publish_result": publish_result,
            }
            st.success(
                "RFQ requirements published to database "
                f"({publish_result.get('rfq_id', 'RFQ saved')})."
            )

    _render_rfq_kpis(
        [
            ("Requirements", len(visible_requirements)),
            ("Value Coverage", f"{total_value:.0f}%"),
            ("Known Cost", f"₹{known_cost:.1f} Cr"),
            ("Budget", f"₹{float(st.session_state.rfq_budget_cr):.1f} Cr"),
            ("Unknown Cost", unknown_cost),
            ("Publish Status", "Published" if st.session_state.published_rfq else "Draft"),
        ]
    )

    _render_rfq_requirement_table(role)


def _load_latest_bid_recommendation_for_rfq() -> None:
    if st.session_state.get("latest_bid_recommendation"):
        return
    run_id = st.session_state.get("demo_bid_run_id")
    if not run_id:
        return
    try:
        result = api.get_bid_run_result(run_id)
    except Exception:
        return
    if result.get("ranked_quotes"):
        st.session_state.latest_bid_recommendation = result
        st.session_state.selected_rfq_quote_id = str(result["ranked_quotes"][0].get("quote_id") or "")


def _lines_from_text(text: str) -> list[str]:
    return [line.strip(" -\t") for line in text.splitlines() if line.strip(" -\t")]


def _render_rfq_guidance(result: dict):
    rfq = result.get("rfq_intake", {})
    negotiation = result.get("negotiation_guidance", {})
    history = result.get("history", {})

    st.divider()
    m1, m2, m3 = st.columns(3)
    m1.metric("Agent Status", str(result.get("status", "completed")).title())
    m2.metric("History Stored", "Yes" if history.get("stored") else "No")
    m3.metric("Mode", str(result.get("mode", "rfq_intake")).replace("_", " ").title())
    if history.get("error"):
        st.warning(f"History storage skipped: {history['error']}")

    st.markdown("### RFQ Intake")
    st.write(rfq.get("requirement_summary", "No requirement summary returned."))
    c1, c2 = st.columns(2)
    with c1:
        _bullet_block("Suggested Requirements", rfq.get("suggested_requirements", []))
        _bullet_block("Mandatory Minimum Criteria", rfq.get("minimum_criteria", []))
    with c2:
        _bullet_block("Negotiable Criteria", rfq.get("negotiable_criteria", []))
        _bullet_block("Missing Inputs", rfq.get("missing_inputs", []))

    st.markdown("### Negotiation Preparation")
    c3, c4 = st.columns(2)
    with c3:
        _bullet_block("Questions For Vendor", negotiation.get("negotiation_questions", []))
        _bullet_block("Contract Conditions", negotiation.get("contract_conditions", []))
    with c4:
        _bullet_block(
            "Cost And Lifecycle Items",
            negotiation.get("cost_or_lifecycle_items", []),
        )
        _bullet_block("Feature Weight Feedback", result.get("feature_weight_feedback", []))

    draft = negotiation.get("vendor_message_draft")
    if draft:
        st.markdown("### Vendor Message Draft")
        st.text_area("Draft", str(draft), height=180, label_visibility="collapsed")

    with st.expander("Evidence, Guardrails, And Raw Agent Output"):
        _bullet_block("Evidence", result.get("evidence", []))
        _bullet_block("Guardrails", result.get("guardrails", []))
        st.json(result)

    st.divider()
    if st.button("Publish RFQ Requirements", type="primary", use_container_width=True):
        request_context = result.get("request_context", {})
        static_inputs = request_context.get("static_inputs", {})
        st.session_state.published_rfq = {
            "procurement_name": static_inputs.get("procurement_name", ""),
            "equipment_type": static_inputs.get("equipment_type", ""),
            "static_inputs": static_inputs,
            "minimum_criteria": rfq.get("minimum_criteria", []),
            "negotiable_criteria": rfq.get("negotiable_criteria", []),
            "suggested_requirements": rfq.get("suggested_requirements", []),
            "missing_inputs": rfq.get("missing_inputs", []),
            "feature_weights": request_context.get("feature_weights", {}),
        }
        st.success("RFQ requirements published for this session.")


def _bullet_block(title: str, items):
    st.markdown(f"**{title}**")
    if not items:
        st.caption("No items returned.")
        return
    for item in items:
        st.markdown(f"- {item}")


def _decision_banner(rep: dict):
    d = rep["recommended_decision"]
    cls = {"GO": "decision-go", "GO WITH CONDITIONS": "decision-cond", "NO-GO": "decision-nogo"}[d]
    st.markdown(
        f"""
        <div class="agent-card" style="border-left:6px solid {RISK_BADGE['CRITICAL'] if d=='NO-GO' else '#d97706'}">
        <h3>{badge(d, '#dc2626' if d=='NO-GO' else ('#d97706' if 'COND' in d else '#16a34a'))}
        &nbsp; Risk {rep['overall_risk_score']:.0f}/100 ·
        Failure {rep['failure_probability_pct']:.0f}% ·
        Confidence {rep['confidence_pct']:.0f}%</h3>
        <b>Predicted failure mode:</b> {rep['predicted_failure_mode']}
        </div>
        """,
        unsafe_allow_html=True,
    )


def _fallback_notice(rep: dict):
    if not rep:
        return
    offline_agents = [
        agent.get("agent", "Agent")
        for agent in rep.get("agent_results", [])
        if agent.get("status") == "offline"
        or agent.get("metrics", {}).get("agentic_output") is False
    ]
    if offline_agents:
        st.warning(
            "Live agentic LLM analysis failed for this run, likely due to API or "
            "internet connectivity. Showing deterministic non-agentic fallback "
            "output for now. Affected agents: "
            + ", ".join(offline_agents)
            + "."
        )


# --------------------------------------------------------------------------- #
# Screen 3 - Agent Investigation Board
# --------------------------------------------------------------------------- #
def screen_agents():
    st.subheader("Screen 3 · Agent Investigation Board")
    rep = st.session_state.report
    if not rep:
        st.info("Run a PreMortem from Screen 2 · Vendor Procurement Input first.")
        return
    _fallback_notice(rep)

    if st.button("▶ Replay live execution"):
        ph = st.empty()
        for a in rep["agent_results"]:
            ph.info(f"⏳ {a['agent']} analyzing...")
            time.sleep(0.5)
        ph.success("All agents completed.")

    cols = st.columns(2)
    for i, a in enumerate(rep["agent_results"]):
        with cols[i % 2]:
            color = RISK_BADGE.get(a["risk_level"], "#64748b")
            st.markdown(
                f"""
                <div class="agent-card" style="margin-bottom:14px;border-left:6px solid {color}">
                  <h4>{a['agent']} {badge(a['risk_level'], color)}</h4>
                  <b>Status:</b> {a['status']} &nbsp;|&nbsp;
                  <b>Risk Score:</b> {a['risk_score']:.0f}/100
                </div>
                """,
                unsafe_allow_html=True,
            )
            with st.expander("Findings, Evidence & Reasoning"):
                st.markdown("**Findings**")
                for fnd in a["findings"]:
                    st.markdown(f"- {fnd}")
                st.markdown("**Evidence**")
                for ev in a["evidence"]:
                    st.markdown(f"- {ev}")
                st.markdown("**Reasoning**")
                st.write(a["reasoning"])
                if a.get("recommendation"):
                    st.markdown("**Recommendation**")
                    st.write(a["recommendation"])


# --------------------------------------------------------------------------- #
# Screen 4 - Agent Debate Room
# --------------------------------------------------------------------------- #
def screen_debate():
    st.subheader("Screen 4 · Agent Debate Room")
    rep = st.session_state.report
    if not rep:
        st.info("Run a PreMortem from Screen 2 · Vendor Procurement Input first.")
        return

    st.caption("Simulated debate among the specialist agents.")
    if st.button("▶ Play debate"):
        ph = st.container()
        for turn in rep["debate"]:
            with ph.chat_message("assistant"):
                st.markdown(f"**{turn['agent']}**")
                for s in turn["statements"]:
                    st.markdown(f"- {s}")
            time.sleep(0.7)
    else:
        for turn in rep["debate"]:
            with st.chat_message("assistant"):
                st.markdown(f"**{turn['agent']}**")
                for s in turn["statements"]:
                    st.markdown(f"- {s}")

    st.divider()
    with st.chat_message("user"):
        st.markdown("**Decision Board Agent** (consensus)")
        st.markdown(
            f"After weighing all positions: **{rep['recommended_decision']}** — "
            f"overall risk {rep['overall_risk_score']:.0f}/100 with "
            f"{rep['confidence_pct']:.0f}% confidence."
        )


# --------------------------------------------------------------------------- #
# Screen 5 - Procurement Risk Analysis
# --------------------------------------------------------------------------- #
def screen_dashboard():
    st.subheader("Screen 5 · Procurement Risk Analysis")
    rep = st.session_state.report
    if not rep:
        st.info("Run a PreMortem from Screen 2 · Vendor Procurement Input first.")
        return

    _decision_banner(rep)

    m1, m2, m3, m4, m5 = st.columns(5)
    m1.metric("Overall Risk", f"{rep['overall_risk_score']:.0f}/100")
    m2.metric("Failure Probability", f"{rep['failure_probability_pct']:.0f}%")
    m3.metric("Predicted Delay", f"{rep['predicted_delay_months']:.0f} mo")
    m4.metric("Projected Loss", f"₹{rep['projected_financial_loss_cr']:.2f} Cr")
    m5.metric("Confidence", f"{rep['confidence_pct']:.0f}%")

    c1, c2 = st.columns([1, 1])
    with c1:
        st.plotly_chart(charts.risk_gauge(rep["overall_risk_score"]), use_container_width=True)
        st.plotly_chart(charts.agent_radar(rep["agent_results"]), use_container_width=True)
    with c2:
        st.plotly_chart(
            charts.agent_contribution_bar(rep["agent_results"]), use_container_width=True
        )
        st.plotly_chart(charts.risk_heatmap(rep["agent_results"]), use_container_width=True)

    st.plotly_chart(charts.scenario_timeline(rep["scenarios"]), use_container_width=True)


# --------------------------------------------------------------------------- #
# Screen 6 - PreMortem Report
# --------------------------------------------------------------------------- #
def screen_report():
    st.subheader("Screen 6 · PreMortem Report")
    rep = st.session_state.report
    if not rep:
        st.info("Run a PreMortem from Screen 2 · Vendor Procurement Input first.")
        return

    st.markdown(f"## PREMORTEM REPORT — {rep['procurement_name']}")
    _decision_banner(rep)

    c1, c2 = st.columns(2)
    with c1:
        st.markdown("### Supporting Evidence")
        for e in rep["supporting_evidence"]:
            st.markdown(f"- {e}")
    with c2:
        st.markdown("### Predicted Outcomes")
        for o in rep["predicted_outcomes"]:
            st.markdown(f"- {o}")

    st.markdown("### Final Recommendation")
    st.markdown(f"**{rep['recommended_decision']}** — approve only after:")
    for c in rep["conditions"]:
        st.markdown(f"- {c}")

    st.divider()
    st.markdown("### Export")
    d1, d2, d3 = st.columns(3)
    with d1:
        if st.button("Generate PDF", use_container_width=True):
            _download("pdf", rep, "application/pdf")
    with d2:
        if st.button("Generate Word", use_container_width=True):
            _download(
                "docx",
                rep,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
    with d3:
        if st.button("Generate JSON", use_container_width=True):
            _download("json", rep, "application/json")


def _download(fmt: str, rep: dict, mime: str):
    try:
        data = api.export_report(fmt, rep)
        st.download_button(
            f"⬇ Download {fmt.upper()}",
            data=data,
            file_name=f"{rep['procurement_name'].replace(' ', '_')}_premortem.{fmt}",
            mime=mime,
            use_container_width=True,
        )
    except Exception as e:
        st.error(f"Export failed: {e}")


# --------------------------------------------------------------------------- #
# Screen 7 - Database / Memory
# --------------------------------------------------------------------------- #
def screen_database():
    st.subheader("Screen 7 · Database / Memory")
    st.caption(
        "Read-only view of the local Postgres/pgvector state. "
        "Agent memory and decision history are intentionally tracked separately."
    )

    try:
        status = api.database_status()
    except Exception as e:
        st.error(f"Could not read database status: {e}")
        return

    if status.get("error"):
        st.warning(status["error"])

    c1, c2, c3 = st.columns(3)
    c1.metric(
        "Database",
        "Connected" if status.get("database_connected") else "Offline",
    )
    c2.metric(
        "pgvector",
        "Available" if status.get("pgvector_available") else "Missing",
    )
    c3.metric(
        "DATABASE_URL",
        "Set" if status.get("database_configured") else "Missing",
    )

    tables = status.get("tables", {})
    memory = tables.get("agent_memory_chunks", {})
    history = tables.get("decision_history", {})
    history_chunks = tables.get("decision_history_chunks", {})
    rfq_sessions = tables.get("rfq_sessions", {})
    rfq_requirements = tables.get("rfq_requirements", {})

    st.divider()
    m1, m2, m3 = st.columns(3)
    m1.metric(
        "Agent Memory Rows",
        int(memory.get("row_count") or 0),
        "table exists" if memory.get("exists") else "table missing",
    )
    m2.metric(
        "Decision History Rows",
        int(history.get("row_count") or 0),
        "table exists" if history.get("exists") else "not added yet",
    )
    m3.metric(
        "History Chunk Rows",
        int(history_chunks.get("row_count") or 0),
        "table exists" if history_chunks.get("exists") else "not added yet",
    )
    r1, r2 = st.columns(2)
    r1.metric(
        "Published RFQs",
        int(rfq_sessions.get("row_count") or 0),
        "table exists" if rfq_sessions.get("exists") else "not added yet",
    )
    r2.metric(
        "RFQ Requirements",
        int(rfq_requirements.get("row_count") or 0),
        "table exists" if rfq_requirements.get("exists") else "not added yet",
    )

    if status.get("recent_memory_rows"):
        st.markdown("### Recent Agent Memory Chunks")
        st.dataframe(status["recent_memory_rows"], use_container_width=True)
    else:
        st.info("No agent memory rows found yet.")

    if status.get("recent_decision_rows"):
        st.markdown("### Recent Decision History")
        st.dataframe(status["recent_decision_rows"], use_container_width=True)
    else:
        st.info(
            "Decision history storage has not been populated yet. "
            "The next backend step is to add `decision_history` and "
            "`decision_history_chunks` writes after run completion."
        )


# --------------------------------------------------------------------------- #
# Screen 8 - Market Research
# --------------------------------------------------------------------------- #
def screen_market_research():
    st.subheader("Screen 8 · Market Research")

    bid_id = st.text_input("Bid ID", value="BID-001")
    if st.button("Load latest market research", use_container_width=True):
        st.session_state.market_research_bid_id = bid_id

    bid_id = st.session_state.get("market_research_bid_id", bid_id)
    try:
        latest_run = api.get_latest_bid_run(bid_id)
        artifact = api.get_bid_run_artifact(
            latest_run["run_id"],
            "artifact_market_research",
        )
    except Exception as e:
        st.info(f"No market research artifact found yet: {e}")
        return

    st.caption(f"Latest run: {latest_run['run_id']}")
    content = artifact.get("content") or {}
    market = content.get("market_research") or {}
    if not market:
        st.info("Market research artifact is not ready yet.")
        return

    status = market.get("status", "completed")
    provider = market.get("provider", "")
    retrieved_at = market.get("retrieved_at", "")
    st.markdown(f"**Provider:** `{provider}`  \n**Status:** `{status}`  \n**Retrieved:** `{retrieved_at}`")

    if market.get("limitations"):
        with st.expander("Limitations", expanded=status == "skipped"):
            for item in market.get("limitations", []):
                st.markdown(f"- {item}")

    _render_benchmark_field("Market Price Range", market.get("market_price_range"))

    typical_terms = market.get("typical_terms") or {}
    if typical_terms:
        st.markdown("### Typical Terms")
        for label, value in typical_terms.items():
            _render_benchmark_field(label.replace("_", " ").title(), value)

    _render_benchmark_field(
        "Consumables And Lifecycle Costs",
        market.get("consumables_and_lifecycle_costs"),
    )
    _render_benchmark_field(
        "Current Market Or Future Trends",
        market.get("current_market_or_future_trends"),
    )
    _render_benchmark_field(
        "Regulatory Or Certification Expectations",
        market.get("regulatory_or_certification_expectations"),
    )

    if market.get("red_flags"):
        st.markdown("### Red Flags")
        for item in market["red_flags"]:
            st.markdown(f"- {item}")

    signals = market.get("vendor_or_product_reputation_signals") or []
    if signals:
        st.markdown("### Benchmark / Reputation Signals")
        for signal in signals:
            title = signal.get("vendor_name") or signal.get("source_organization") or "Signal"
            with st.expander(str(title)):
                st.write(signal.get("signal", ""))
                if signal.get("interpretation"):
                    st.markdown("**Interpretation**")
                    st.write(signal["interpretation"])
                _render_sources(signal.get("sources") or [], expandable=False)


def _render_benchmark_field(title: str, value):
    if not value:
        return
    st.markdown(f"### {title}")
    if isinstance(value, dict):
        confidence = value.get("confidence")
        if confidence:
            st.caption(f"Confidence: {confidence}")
        summary = value.get("summary")
        if summary:
            st.write(summary)
        for key in ("known_consumables", "recurring_cost_risks", "signals"):
            items = value.get(key) or []
            if items:
                st.markdown(f"**{key.replace('_', ' ').title()}**")
                for item in items:
                    st.markdown(f"- {item}")
        _render_sources(value.get("sources") or [])
    else:
        st.write(value)


def _render_sources(sources, expandable: bool = True):
    if not sources:
        return
    if expandable:
        with st.expander("Sources"):
            _render_source_items(sources)
    else:
        st.markdown("**Sources**")
        _render_source_items(sources)


def _render_source_items(sources):
    for source in sources:
        if isinstance(source, dict):
            url = source.get("url", "")
            note = source.get("note", "")
            if url:
                st.markdown(f"- [{url}]({url})")
            if note:
                st.caption(note)
        else:
            st.markdown(f"- {source}")


# --------------------------------------------------------------------------- #
# Bonus Lab - What-If / Digital Twin
# --------------------------------------------------------------------------- #
def screen_bonus():
    st.subheader("★ Bonus Lab · Digital Twin & What-If Analysis")
    rep = st.session_state.report
    if not st.session_state.form:
        st.info("Run a PreMortem from Screen 2 · Vendor Procurement Input first.")
        return

    st.caption(
        "Adjust the procurement levers and re-simulate to see how the risk "
        "profile and decision change — a live digital twin of the procurement."
    )
    base = dict(st.session_state.form)

    c1, c2, c3 = st.columns(3)
    with c1:
        construction = st.slider(
            "Construction Completion %",
            0,
            100,
            int(base["construction_completion_pct"]),
        )
        advance = st.slider("Advance Payment %", 0, 100, int(base["advance_payment_pct"]))
    with c2:
        warranty = st.selectbox(
            "Warranty Start",
            ["On Delivery", "On Installation", "On Commissioning"],
            index=["On Delivery", "On Installation", "On Commissioning"].index(
                base["warranty_start"]
            ),
        )
        electrical = st.selectbox(
            "Electrical Readiness",
            ["Approved", "Pending", "Not Started"],
            index=["Approved", "Pending", "Not Started"].index(base["electrical_readiness"]),
        )
    with c3:
        regulatory = st.selectbox(
            "Regulatory Approval",
            ["Approved", "Pending", "Not Started"],
            index=["Approved", "Pending", "Not Started"].index(
                base["regulatory_approval_status"]
            ),
        )
        techs = st.number_input(
            "Technicians Available", value=int(base["technicians_available"]), step=1
        )

    if st.button("🔁 Re-simulate (What-If)", type="primary"):
        whatif = {
            **base,
            "construction_completion_pct": construction,
            "advance_payment_pct": advance,
            "warranty_start": warranty,
            "electrical_readiness": electrical,
            "regulatory_approval_status": regulatory,
            "technicians_available": techs,
        }
        with st.spinner("Re-running agents on the twin scenario..."):
            try:
                new_rep = api.analyze(whatif)
            except Exception as e:
                st.error(f"Simulation failed: {e}")
                return

        cc1, cc2 = st.columns(2)
        with cc1:
            st.markdown("#### Original")
            if rep:
                st.metric("Risk", f"{rep['overall_risk_score']:.0f}/100")
                st.metric("Decision", rep["recommended_decision"])
                st.metric("Projected Loss", f"₹{rep['projected_financial_loss_cr']:.2f} Cr")
        with cc2:
            st.markdown("#### What-If Twin")
            delta = (
                new_rep["overall_risk_score"] - rep["overall_risk_score"]
                if rep
                else 0
            )
            st.metric("Risk", f"{new_rep['overall_risk_score']:.0f}/100", delta=f"{delta:+.0f}")
            st.metric("Decision", new_rep["recommended_decision"])
            st.metric(
                "Projected Loss", f"₹{new_rep['projected_financial_loss_cr']:.2f} Cr"
            )
        st.plotly_chart(
            charts.agent_contribution_bar(new_rep["agent_results"]),
            use_container_width=True,
        )

    st.divider()
    st.markdown("#### Failure-Loss Sensitivity Curve")
    asset = float(base["contract_value_cr"])
    delays = list(range(0, 13))
    losses = [round(asset * 0.08 * (d / 12.0), 2) for d in delays]
    st.plotly_chart(charts.whatif_curve(delays, losses), use_container_width=True)


# --------------------------------------------------------------------------- #
# Router
# --------------------------------------------------------------------------- #
if screen.startswith("About"):
    screen_about()
elif screen.startswith("1"):
    screen_rfq_intake()
elif screen.startswith("2"):
    screen_input()
elif screen.startswith("3"):
    screen_agents()
elif screen.startswith("4"):
    screen_debate()
elif screen.startswith("5"):
    screen_dashboard()
elif screen.startswith("6"):
    screen_report()
elif screen.startswith("7"):
    screen_database()
elif screen.startswith("8"):
    screen_market_research()
else:
    screen_bonus()
