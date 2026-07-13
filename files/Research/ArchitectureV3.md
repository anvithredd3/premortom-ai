# Architecture V3 – Agentic Procurement Intelligence Platform

## Why V3?

The current implementation demonstrates a Procurement PreMortem workflow. While useful as a proof of concept, the architecture remains tightly coupled to a specific MRI procurement scenario.

The goal is not to replace the existing PreMortem implementation. Instead, the current PreMortem becomes the first workflow implemented on top of a more generic agentic architecture.

## Relationship Between PreMortem and Architecture

**PreMortem is a workflow, not the architecture.**

Potential workflows:
- Procurement PreMortem
- Vendor Evaluation
- Contract Risk Assessment
- Compliance Audit
- Procurement Approval
- Vendor Selection

## Architecture Diagram

Place this markdown beside Diagram.jpg and use:

![Architecture V3](Diagram.jpg)

## Major Components

Current implementation alignment:

- RFQ Intake and Negotiation UI Guidance Agent supports RFQ creation and vendor
  negotiation preparation.
- Vendor Proposal Agent reads quote PDFs and produces reusable fixed features
  and proposal intelligence.
- Contract Review Agent uses static inputs, learned proposal intelligence, OKF
  memory, and bounded decision history.
- Internet / Market Research Agent can add current market context when enabled.
- Bid Recommendation Agent compares vendor outputs and applies ranking,
  minimum cutoffs, and negotiable exceptions.
- Invoice Monitoring and Contract Compliance Agent is planned as a post-award
  agent for periodic invoice/service compliance and fraud-drift detection.
- pgvector memory is split into OKF memory, run-level decision history, and
  agent-level history.

### UI Agent
- Captures requirements
- Displays workflow progress
- Presents recommendations
- Generates reports

### Orchestrator Agent
- Creates workflow plans
- Coordinates agents
- Manages dependencies
- Runs parallel tasks
- Collects results

### Analysis & Intelligence Agent
(Current Research Agent)
- Gathers evidence
- Analyzes information
- Correlates findings
- Generates conclusions

### Data Acquisition Pipeline Agent
Sources:
- Internet
- Social Media
- Vendor Portals
- Public Data

### Contract Review Agent
Evolution of the current PreMortem implementation.

### Vendor Intelligence Agent
- Reputation
- Performance
- Benchmarks

### Recommendation Agent
Outputs:
- GO
- GO WITH CONDITIONS
- HOLD
- REBID
- REJECT

### Quality Evaluator Agent
- Confidence monitoring
- Validation
- Evaluation

### Internal Communication Agent
- Slack
- Teams
- Email

## Hackathon Scope

Demonstrate:
1. Multi-agent architecture
2. Orchestrator-driven workflow
3. Parallel processing
4. Agent communication
5. Extensible design

## Key Takeaway

A single LLM solves a task.

An agentic system adds value through orchestration, specialization, tool use, evaluation, and collaboration.
