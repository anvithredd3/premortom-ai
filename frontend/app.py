"""PreMortem AI - Streamlit frontend.

Five primary screens plus bonus visualizations, all powered by the FastAPI
backend. Run with:  streamlit run app.py
"""
from __future__ import annotations

import time

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
            "1 · Procurement Input",
            "2 · Agent Investigation Board",
            "3 · Agent Debate Room",
            "4 · Executive Dashboard",
            "5 · PreMortem Report",
            "6 · Database / Memory",
            "7 · Market Research",
            "★ Bonus Lab (What-If / Digital Twin)",
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
# Screen 1 - Procurement Input
# --------------------------------------------------------------------------- #
def screen_input():
    st.subheader("Screen 1 · Procurement Input")

    col_a, col_b = st.columns([2, 1])
    with col_b:
        st.markdown("**Quick start**")
        if st.button("Load AIIMS MRI demo", use_container_width=True):
            try:
                st.session_state.form = api.sample_input()
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
                st.success(
                    f"Parsed {res['characters']} chars · "
                    f"{len(res['extracted_fields'])} fields auto-filled."
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

            b1, b2, b3 = st.columns(3)
            analyze_clicked = b1.form_submit_button(
                "🔍 Analyze Procurement", use_container_width=True
            )
            premortem_clicked = b2.form_submit_button(
                "🧠 Run PreMortem", use_container_width=True, type="primary"
            )
            report_clicked = b3.form_submit_button(
                "📄 Generate Report", use_container_width=True
            )

        if analyze_clicked or premortem_clicked or report_clicked:
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
            }
            st.session_state.form = payload
            with st.spinner("Running multi-agent PreMortem review..."):
                try:
                    st.session_state.report = api.analyze(payload)
                except Exception as e:
                    st.error(f"Analysis failed: {e}")
                    return
            st.success(
                "PreMortem complete. Open the Investigation Board, Debate Room "
                "and Executive Dashboard from the sidebar."
            )
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


# --------------------------------------------------------------------------- #
# Screen 2 - Agent Investigation Board
# --------------------------------------------------------------------------- #
def screen_agents():
    st.subheader("Screen 2 · Agent Investigation Board")
    rep = st.session_state.report
    if not rep:
        st.info("Run a PreMortem on Screen 1 first.")
        return

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
# Screen 3 - Agent Debate Room
# --------------------------------------------------------------------------- #
def screen_debate():
    st.subheader("Screen 3 · Agent Debate Room")
    rep = st.session_state.report
    if not rep:
        st.info("Run a PreMortem on Screen 1 first.")
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
# Screen 4 - Executive Dashboard
# --------------------------------------------------------------------------- #
def screen_dashboard():
    st.subheader("Screen 4 · Executive Dashboard")
    rep = st.session_state.report
    if not rep:
        st.info("Run a PreMortem on Screen 1 first.")
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
# Screen 5 - PreMortem Report
# --------------------------------------------------------------------------- #
def screen_report():
    st.subheader("Screen 5 · PreMortem Report")
    rep = st.session_state.report
    if not rep:
        st.info("Run a PreMortem on Screen 1 first.")
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
# Screen 6 - Database / Memory
# --------------------------------------------------------------------------- #
def screen_database():
    st.subheader("Screen 6 · Database / Memory")
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
# Screen 7 - Market Research
# --------------------------------------------------------------------------- #
def screen_market_research():
    st.subheader("Screen 7 · Market Research")

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
                _render_sources(signal.get("sources") or [])


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


def _render_sources(sources):
    if not sources:
        return
    with st.expander("Sources"):
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
        st.info("Run a PreMortem on Screen 1 first.")
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
if screen.startswith("1"):
    screen_input()
elif screen.startswith("2"):
    screen_agents()
elif screen.startswith("3"):
    screen_debate()
elif screen.startswith("4"):
    screen_dashboard()
elif screen.startswith("5"):
    screen_report()
elif screen.startswith("6"):
    screen_database()
elif screen.startswith("7"):
    screen_market_research()
else:
    screen_bonus()
