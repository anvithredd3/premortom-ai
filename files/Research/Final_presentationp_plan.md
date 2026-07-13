# Approach 1


# Slide 1 — Problem: Complex Decisions Need Team Intelligence

High-value procurement is a cross-functional decision.
Management, finance, technical, legal, and vendors interact.
Risk is spread across RFQ, quote, contract, and invoices.
Market context and vendor history are often fragmented.
Fraud and leakage signals may appear too late.
Existing tools support parts, not the full decision flow.
The need is an auditable decision-intelligence pipeline.
PreMortem AI reviews risk before approval and award.

---

# Slide 2 — Research Framing: Human + Agent Teams

This proposal does not replace human teams.
It augments teams with specialized AI agents.
Humans remain responsible for judgment and approval.
Agents provide analysis, memory, and workflow support.
The design uses human resource management concepts.
Skills, roles, accountability, and review are mapped.
Technical resource management guides agent composition.
The research question is hybrid team orchestration.

---

# Slide 3 — Proposed Framework: Agentic Review Pipeline

PreMortem AI models a digital review board.
Each agent has a role, skill, memory, and guardrail.
RFQ agent captures expectations and criteria.
Vendor agent interprets proposal evidence and gaps.
Market agent researches product and service context.
Contract agent reviews terms, risk, and obligations.
Recommender compares vendors and tradeoffs.
Evaluator checks evidence, confidence, and conflicts.
Humans approve, override, and guide next actions.

---

# Slide 4 — Current Demo and Technical Stack

MRI procurement is the first workflow demo.
The architecture is generic beyond medical equipment.
Streamlit provides bid and decision workflow UI.
FastAPI owns bids, quotes, runs, and artifacts.
PDF quotes are extracted and analyzed.
Agents generate proposal and contract intelligence.
PostgreSQL with pgvector stores memory and history.
OKF-style markdown keeps agent knowledge inspectable.
MCP and A2A are future integration layers.

---

# Slide 5 — Value, Limitations, and Next Research

The platform augments procurement and compliance teams.
It improves auditability and negotiation readiness.
It connects quote review with market and history.
It moves fraud review from reactive to proactive.
It supports post-award invoice and leakage monitoring.
Current workflow is still partly fixed.
Future work adds flexible human-agent coordination.
Research focus: technical resource management for AI teams.
Goal: reusable hybrid workforce architecture.




# Approach 2


# Slide 1 — HCL Opportunity: Agentic Workforce

HCL can move beyond resource supply.
It can offer agentic workforce solutions.
Agents can bring reusable digital skills.
Human teams can supervise and approve.
HR concepts can guide agent skill mapping.
Procurement is the first strong use case.
Fraud protection is one capability in it.
The larger value is autonomous execution.
This creates a new service delivery model.

---

# Slide 2 — Problem: Procurement Risk Is Fragmented

Procurement is not only price comparison.
Risk is spread across the full lifecycle.
RFQ, quote, contract, service, and invoices connect.
Vendors may hide gaps in vague proposal text.
Supplies, spares, training, and support matter.
Market context is often missing at approval.
Fraud and leakage appear after award.
Existing tools solve isolated process parts.
The gap is end-to-end decision intelligence.

---

# Slide 3 — Proposal: Agentic Procurement Department

PreMortem AI models a digital procurement team.
Each agent owns a role, skill, and responsibility.
RFQ agent captures business expectations.
Vendor agent reads and interprets proposals.
Market agent compares products and services.
Contract agent finds risky terms and gaps.
Recommender ranks vendors and tradeoffs.
Evaluator checks evidence and confidence.
Humans approve, override, and guide the flow.

---

# Slide 4 — Architecture and Current Demo

MRI procurement is the first workflow demo.
The platform is generic beyond MRI.
FastAPI owns bids, quotes, runs, and artifacts.
Streamlit shows workflow and decision state.
PDF quotes are extracted and analyzed.
Agents generate proposal and contract findings.
pgvector stores memory and decision history.
OKF-style markdown keeps knowledge inspectable.
MCP and A2A can add future integrations.

---

# Slide 5 — Business Value and Next Steps

This helps HCL package agentic services.
It connects AI agents with human delivery teams.
It supports HR-style skill and team mapping.
It improves auditability and negotiation readiness.
It shifts fraud review from reactive to proactive.
It can extend to invoices and leakage monitoring.
Next step: show demo runs and metrics.
Document bids, quotes, agents, memory, and outputs.
Position as reusable agentic business workflow.


# comparison


Pre-approval risk prediction accuracy: GO / GO WITH CONDITIONS / HOLD / REJECT before award.
CSS>> Useful demo outcome, but it should not be positioned as the most unique differentiator by itself.
Auditability and explainability: evidence-backed reasoning, conditions, and decision trail.
CSS >> Strong technical capability. It becomes more valuable when connected to benchmarking, quality analysis, and decision review.
Negotiation readiness: clear vendor gaps, follow-up questions, and draft negotiation points.
CSS >> Important agentic convenience and a strong demo feature, but the business value should be connected to better vendor outcomes and reduced review effort.
Memory-driven improvement: learning from past decisions, vendor history, and agent history.
CSS >> This is important for technical credibility. Position OKF and pgvector memory as the current knowledge-resource-management layer.
Lifecycle leakage prevention: post-award invoice, service, supplies, and contract compliance monitoring.
CSS >> Valuable extension, especially for post-award monitoring. It may be better positioned as lifecycle expansion rather than the first headline.


/home/chinmaey/Documents/Backup/AI/AgenticAI/Hackathon/premortom-ai/files/Research/comparison.jpeg

for Pre-approval failure prediction / GO-NO-GO
CSS>> Useful and easy to understand, but should be framed as one output of the agentic review process rather than the core differentiator.
Cross-domain risk reasoning: contract + site + workforce + finance + history
CSS >> This is better wording for the business. 
CSS>> Be careful with saying competitors are siloed unless we have evidence. Better wording: existing platforms are primarily workflow/platform focused, while our proposal emphasizes configurable cross-domain agent collaboration.
Explainable, audit-ready verdict: evidence + reasoning + conditions
CSS >> same as above . 
Learns from past decisions: decision memory / pgvector
CSS >> we should avoid claiming others do not have historical analytics unless sourced. Position our difference as inspectable agent memory, decision history, and customer-specific knowledge resources.
Runs fully offline or on-prem: no API key, no data egress
CSS >> Current demo uses OpenAI APIs, so this should be stated carefully. Better: local orchestration and Docker deployment today; private/on-prem model option as a future enterprise deployment path.
Deploys in minutes: Docker, low cost
CSS >> Docker is useful for demo reproducibility, but not a main business USP. It can support the engineering story rather than lead the comparison.
Workflow automation: sourcing, invoicing, spend, P2P
CSS >> This is a core strength of established procurement platforms, so it should not be presented as our edge. We can show that we complement workflow automation with decision intelligence.
CSS> How about we pitch it in this way
generic design that for procurement process that can be tailored to customers as our agentic design flexible agent selection and knowledge resource management 
We pitch like HCL can pitch a trainable team of experts that can take up customer specific roles.
And this makes the important highlight.


# Selected

## Selected Pitch

Autonomous agentic expert team with human touch.

## Selected KPI Positioning

1. Configurable autonomous agentic expert team with human touch.
   The platform can run analysis with minimal human dependency, while human experts provide judgment, policy direction, approval, and customer-specific nuance where needed. The key idea is that agents are modeled as skill resources with defined roles, memory, and connections. This allows HR and team-management practices to be applied to agent teams, while humans remain part of the higher-level team context.

2. Cross-domain procurement risk reasoning.
   The system connects contract terms, vendor proposal evidence, site readiness, workforce readiness, finance exposure, internet-based market context, and historical decisions.

3. Customer-specific knowledge and policy adaptation.
   Agent roles, OKF memory, RAG, decision history, and agent-level history can be tailored to each customer's procurement rules, risk priorities, and operating model.

4. Audit-ready evidence and quality benchmarking.
   Outputs should show evidence, reasoning, conditions, confidence, gaps, and benchmark context so reviewers can understand and defend the recommendation. The Quality Evaluation Agent strengthens this by checking evidence quality, confidence, conflicts, and benchmark alignment.

5. Lifecycle compliance and leakage monitoring.
   The design extends beyond the award decision into invoice, service, consumables, parts, contract compliance, and fraud/drift monitoring. This expands the proposal from pre-award decision support into lifecycle risk and leakage prevention.

## Selected Technical Considerations

OKF memory should be positioned as more than static prompt context. It can evolve
into an agent capability layer where each agent receives task-specific context,
skills, tools, MCP connectors, and A2A communication contracts.

Memory should not be treated as one generic vector bucket. Each agent can have a
different chunking schema and retrieval policy based on its role:

- Contract Review Agent can chunk by clause, obligation, risk category, and
  missing term.
- Vendor Proposal Agent can chunk by vendor fact, missing evidence,
  differentiator, unusual term, and follow-up question.
- Internet / Market Research Agent can chunk by benchmark fact, source quality,
  market signal, and confidence.
- Bid Recommender Agent can chunk by ranking rationale, cutoff exception,
  tradeoff, and negotiation condition.
- UI Guidance Agent can chunk by accepted RFQ criteria, role-specific
  expectation, and negotiation pattern.

For the current implementation, the embedding model should remain centrally
managed and shared for simplicity. Agent-specific chunking, metadata filters,
retrieval limits, and ranking policies provide most of the benefit while keeping
pgvector indexes easier to operate.

Future versions can support agent-specific embedding models if evaluation shows
clear benefit. That requires tracking embedding dimensions, index compatibility,
cost, latency, and quality per agent. The safer architecture statement is:

> We keep the embedding layer replaceable and centrally managed, while allowing
> each agent to define its own memory schema, chunking strategy, and retrieval
> policy.

## Comparison Framing

The safest comparison is not "existing platforms cannot do this." The stronger
and more defensible comparison is:

Existing procurement platforms are strong at workflow automation, sourcing,
spend, invoicing, and procurement operations. PreMortem AI is positioned as a
configurable decision-intelligence layer that creates a trainable agentic expert
team for customer-specific procurement review, negotiation readiness, memory,
and lifecycle risk monitoring.
