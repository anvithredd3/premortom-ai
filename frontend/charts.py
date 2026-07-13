"""Plotly visualizations for the PreMortem dashboard."""
from __future__ import annotations

from typing import List
import math

import plotly.graph_objects as go


RISK_COLORS = {
    "LOW": "#16a34a",
    "MODERATE": "#eab308",
    "HIGH": "#f97316",
    "CRITICAL": "#dc2626",
}

ROLE_COLORS = {
    "management": "#334155",
    "doctor": "#2563eb",
    "biomedical_engineer": "#16a34a",
    "finance": "#d97706",
    "procurement_officer": "#7c3aed",
    "it": "#0891b2",
    "compliance_legal": "#be123c",
    "operations": "#ea580c",
    "patient_user": "#0d9488",
}


def risk_gauge(score: float) -> go.Figure:
    fig = go.Figure(
        go.Indicator(
            mode="gauge+number",
            value=score,
            number={"suffix": "/100", "font": {"size": 40}},
            title={"text": "Overall Risk Score"},
            gauge={
                "axis": {"range": [0, 100], "tickwidth": 1},
                "bar": {"color": "#0f172a"},
                "steps": [
                    {"range": [0, 35], "color": "#bbf7d0"},
                    {"range": [35, 60], "color": "#fef08a"},
                    {"range": [60, 80], "color": "#fed7aa"},
                    {"range": [80, 100], "color": "#fecaca"},
                ],
                "threshold": {
                    "line": {"color": "#dc2626", "width": 4},
                    "thickness": 0.75,
                    "value": score,
                },
            },
        )
    )
    fig.update_layout(height=300, margin=dict(l=20, r=20, t=50, b=10))
    return fig


def agent_contribution_bar(agents: List[dict]) -> go.Figure:
    names = [a["agent"].replace(" Agent", "") for a in agents]
    scores = [a["risk_score"] for a in agents]
    colors = [RISK_COLORS.get(a["risk_level"], "#64748b") for a in agents]
    fig = go.Figure(
        go.Bar(
            x=scores,
            y=names,
            orientation="h",
            marker_color=colors,
            text=scores,
            textposition="outside",
        )
    )
    fig.update_layout(
        title="Agent Risk Contributions",
        xaxis=dict(range=[0, 100], title="Risk Score"),
        height=320,
        margin=dict(l=10, r=10, t=50, b=10),
    )
    return fig


def agent_radar(agents: List[dict]) -> go.Figure:
    names = [a["agent"].replace(" Agent", "") for a in agents]
    scores = [a["risk_score"] for a in agents]
    fig = go.Figure(
        go.Scatterpolar(
            r=scores + [scores[0]],
            theta=names + [names[0]],
            fill="toself",
            line_color="#dc2626",
            fillcolor="rgba(220,38,38,0.25)",
        )
    )
    fig.update_layout(
        polar=dict(radialaxis=dict(visible=True, range=[0, 100])),
        title="Multi-Agent Consensus",
        height=360,
        margin=dict(l=30, r=30, t=50, b=30),
    )
    return fig


def risk_heatmap(agents: List[dict]) -> go.Figure:
    names = [a["agent"].replace(" Agent", "") for a in agents]
    scores = [a["risk_score"] for a in agents]
    fig = go.Figure(
        go.Heatmap(
            z=[scores],
            x=names,
            y=["Risk"],
            colorscale=[
                [0.0, "#16a34a"],
                [0.35, "#eab308"],
                [0.6, "#f97316"],
                [0.8, "#dc2626"],
                [1.0, "#7f1d1d"],
            ],
            zmin=0,
            zmax=100,
            text=[scores],
            texttemplate="%{text}",
            showscale=True,
        )
    )
    fig.update_layout(
        title="Procurement Risk Heatmap",
        height=200,
        margin=dict(l=10, r=10, t=50, b=10),
    )
    return fig


def scenario_timeline(scenarios: List[dict]) -> go.Figure:
    names = [s["name"] for s in scenarios]
    timelines = [s["timeline_months"] for s in scenarios]
    losses = [s["financial_impact_cr"] for s in scenarios]
    fig = go.Figure()
    fig.add_trace(
        go.Bar(name="Delay (months)", x=names, y=timelines, marker_color="#3b82f6")
    )
    fig.add_trace(
        go.Bar(
            name="Financial Impact (Cr)",
            x=names,
            y=losses,
            marker_color="#ef4444",
            yaxis="y2",
        )
    )
    fig.update_layout(
        title="Failure Timeline & Financial Simulation",
        yaxis=dict(title="Delay (months)"),
        yaxis2=dict(title="Loss (Cr)", overlaying="y", side="right"),
        barmode="group",
        height=360,
        margin=dict(l=10, r=10, t=50, b=10),
    )
    return fig


def whatif_curve(delays: List[float], losses: List[float]) -> go.Figure:
    fig = go.Figure(
        go.Scatter(
            x=delays,
            y=losses,
            mode="lines+markers",
            line=dict(color="#dc2626", width=3),
            fill="tozeroy",
            fillcolor="rgba(220,38,38,0.15)",
        )
    )
    fig.update_layout(
        title="What-If: Financial Loss vs Delay",
        xaxis_title="Installation Delay (months)",
        yaxis_title="Projected Loss (Cr)",
        height=320,
        margin=dict(l=10, r=10, t=50, b=10),
    )
    return fig


def rfq_radial_requirement_map(requirements: List[dict], quote_fit: dict | None = None) -> go.Figure:
    """Show role-level value coverage as a clean radar map."""
    roles = list(ROLE_COLORS.keys())[:5]
    values_by_role = {role: 0.0 for role in roles}
    counts_by_role = {role: 0 for role in roles}
    for req in requirements:
        role = req.get("role", "management")
        if role not in values_by_role:
            continue
        values_by_role[role] += float(req.get("perspective_value_pct") or 0)
        counts_by_role[role] += 1

    labels = [_role_label(role) for role in roles]
    values = [min(100, values_by_role[role]) for role in roles]
    hover = [
        f"{label}<br>Value coverage: {value:.0f}%<br>Requirements: {counts_by_role[role]}"
        for label, value, role in zip(labels, values, roles)
    ]
    fig = go.Figure()
    fig.add_trace(
        go.Scatterpolar(
            r=values + [values[0]],
            theta=labels + [labels[0]],
            fill="toself",
            mode="lines",
            name="RFQ value",
            line_color="#2563eb",
            fillcolor="rgba(37,99,235,0.20)",
            hovertext=hover + [hover[0]],
            hoverinfo="text",
        )
    )
    if quote_fit:
        quote_values = [
            min(100, float((quote_fit.get("role_values") or {}).get(role, 0)))
            for role in roles
        ]
        quote_name = str(quote_fit.get("quote_id") or "Selected quote")
        fig.add_trace(
            go.Scatterpolar(
                r=quote_values + [quote_values[0]],
                theta=labels + [labels[0]],
                fill="toself",
                mode="lines",
                name=quote_name,
                line=dict(color="#7f1d1d", width=3),
                fillcolor="rgba(127,29,29,0.18)",
                hovertext=[
                    f"{label}<br>{quote_name} fit: {value:.0f}%"
                    for label, value in zip(labels, quote_values)
                ] + [f"{labels[0]}<br>{quote_name} fit: {quote_values[0]:.0f}%"],
                hoverinfo="text",
            )
        )
    fig.update_layout(
        title=dict(text="Procurement Value Map", font=dict(size=14)),
        polar=dict(
            radialaxis=dict(
                visible=True,
                range=[0, 100],
                tickfont=dict(size=12),
            ),
            angularaxis=dict(tickfont=dict(size=13)),
        ),
        height=380,
        margin=dict(l=20, r=20, t=50, b=20),
        showlegend=bool(quote_fit),
        font=dict(size=13),
    )
    return fig


def rfq_cost_confidence_meter(
    requirements: List[dict],
    device_cost_cr: float,
    quote_cost_cr: float | None = None,
) -> go.Figure:
    """Vertical overlapped cost meter: budget range with actual cost marker."""
    known = [
        req for req in requirements
        if req.get("estimated_cost_cr") not in (None, "", 0)
    ]
    actual_cost = sum(float(req.get("estimated_cost_cr") or 0) for req in known)
    budget_cost = float(device_cost_cr or 0)
    quote_cost = float(quote_cost_cr or 0)
    max_cost = max(budget_cost, actual_cost, quote_cost, 1)
    fig = go.Figure()
    fig.add_shape(
        type="line",
        x0=0.5,
        x1=0.5,
        y0=0,
        y1=budget_cost,
        line=dict(color="#cbd5e1", width=9),
    )
    fig.add_shape(
        type="line",
        x0=0.5,
        x1=0.5,
        y0=0,
        y1=actual_cost,
        line=dict(color="#2563eb", width=9),
    )
    fig.add_trace(
        go.Scatter(
            x=[0.5, 0.5],
            y=[actual_cost, budget_cost],
            mode="markers+text",
            marker=dict(
                color=["#2563eb", "#94a3b8"],
                size=[22, 18],
                line=dict(color="#ffffff", width=3),
            ),
            text=[f"₹{actual_cost:.1f}", f"₹{budget_cost:.1f}"],
            textposition=["middle right", "top center"],
            hovertext=[
                f"Actual costed requirements<br>₹{actual_cost:.2f} Cr",
                f"Budget / max cost<br>₹{budget_cost:.2f} Cr",
            ],
            hoverinfo="text",
            showlegend=False,
        )
    )
    if quote_cost > 0:
        fig.add_shape(
            type="line",
            x0=0.63,
            x1=0.63,
            y0=0,
            y1=quote_cost,
            line=dict(color="#7f1d1d", width=8),
        )
        fig.add_trace(
            go.Scatter(
                x=[0.63],
                y=[quote_cost],
                mode="markers+text",
                marker=dict(color="#7f1d1d", size=20, line=dict(color="#ffffff", width=3)),
                text=[f"₹{quote_cost:.1f}"],
                textposition=["middle right"],
                hovertext=[f"Selected quote cost<br>₹{quote_cost:.2f} Cr"],
                hoverinfo="text",
                showlegend=False,
            )
        )
    fig.update_layout(
        title=dict(text="Cost Meter", font=dict(size=16), x=0.5, xanchor="center"),
        yaxis=dict(
            range=[0, max_cost * 1.2],
            visible=False,
        ),
        xaxis=dict(
            range=[0, 1],
            visible=True,
            showticklabels=False,
            ticks="",
            title=dict(text="Rs Crores", font=dict(size=12)),
            showline=False,
            zeroline=False,
            showgrid=False,
        ),
        height=300,
        margin=dict(l=0, r=8, t=44, b=34),
        showlegend=False,
        font=dict(size=12),
        annotations=[
            dict(
                x=0.5,
                y=0,
                text="₹0",
                showarrow=False,
                yshift=-12,
                font=dict(size=12, color="#64748b"),
            )
        ],
    )
    return fig


def _role_label(role: str) -> str:
    return str(role).replace("_", " ").title()


def _polygon_area_pct(values: List[float]) -> float:
    if len(values) < 3:
        return 0.0
    theta = (2 * math.pi) / len(values)
    area = 0.0
    max_area = 0.0
    for idx, value in enumerate(values):
        next_value = values[(idx + 1) % len(values)]
        area += value * next_value * math.sin(theta) / 2
        max_area += 100 * 100 * math.sin(theta) / 2
    if max_area <= 0:
        return 0.0
    return max(0.0, min(100.0, (area / max_area) * 100))
