# High-Level Agent Architecture v3: PreMortem AI

## 1. Goal

PreMortem AI should evolve from a single MRI procurement demo into a **generic agentic business decision review framework**.

The MRI procurement scenario remains the first working demo, but the architecture should support other business workflows later, such as:

- Procurement approval
- Vendor evaluation
- Contract review
- Cost optimization
- Compliance review
- Continuous monitoring after approval

The broader goal is to show that PreMortem AI is not only a medical-equipment risk analyzer, but a reusable decision-review platform.

---

## Relationship Between PreMortem and Architecture

PreMortem is a workflow, not the architecture.

The current MRI procurement implementation should be viewed as the first workflow implemented on top of a generic Agentic Business Decision Review Platform.

Potential future workflows include:

- Procurement PreMortem
- Vendor Evaluation
- Contract Risk Assessment
- Compliance Audit
- Procurement Approval
- Vendor Selection
- Cost Optimization

## 2. Core Idea

PreMortem AI simulates a business review board before a high-risk decision is approved.

Instead of one model producing one answer, the system uses multiple agents that investigate different dimensions of the decision. The agents can run in parallel, return structured findings, and provide evidence to an orchestrator.

The orchestrator acts like a human manager:

- Receives the business request
- Decides which agents should participate
- Sends tasks to agents
- Waits for responses
- Consolidates findings
- Sends outputs to an evaluator
- Presents the final decision package to the UI

The current MRI workflow can be treated as the first specialized client workflow built on top of this generic architecture.

---

## 3. Architecture Principle

The architecture should separate:

1. **Generic Agentic Workflow**
   - Orchestration
   - Parallel execution
   - Evaluation
   - Decision summary
   - UI state tracking

2. **Domain-Specific Interfaces**
   - Procurement fields
   - MRI-specific checklist
   - Client-specific rules
   - Compliance requirements
   - Vendor-specific benchmarks

This separation makes the solution easier to customize for different clients and business workflows.

---

## Architecture Diagram

![Architecture V3](Diagram.jpg)

The diagram illustrates the long-term architecture vision.

The weekend implementation will focus on a subset of these components while preserving the overall architecture.

---

## 4. Generic Workflow

```text
Business Request
      ↓
UI Guidance Agent / Intake Assistant
      ↓
Customer / Requirement Intake Agent
      ↓
Orchestrator / Manager Agent
      ↓
Parallel Execution Layer
      ↓
Specialist Agents
      ↓
Evaluator Agent
      ↓
Decision Summary Agent
      ↓
UI Dashboard / Human Review
```

The orchestrator owns the workflow. The parallel execution layer is an implementation mechanism that helps scale agent calls and prevent blocking.

RAG opportunity: CSV/JSON files and run artifacts are sufficient for the demo, while future RAG can improve retrieval of prior decisions, vendor history, policy knowledge, reviewer feedback, and chatbot guidance.

For production-style robustness, the execution layer can later support:

- Timeouts
- Retries
- Circuit breakers
- Partial results
- Cost controls
- Agent failure handling

---

## 5. Main Components

### 5.1 Workflow Input Layer

The workflow input layer accepts the business decision request.

For the current demo, the input is MRI procurement data.

Later, the same design can support:

- Vendor onboarding
- Contract approval
- Cost benchmarking
- Sourcing decision review
- Compliance audit
- Post-approval monitoring

The input layer should eventually support:

- Forms
- Uploaded documents
- Structured procurement data
- Emails or communication extracts
- External system inputs

---

### 5.2 UI Guidance Agent

The UI Guidance Agent is an optional agent-assisted UI layer. It should help the user move through the workflow, but it should not own core storage, orchestration, or final decision logic.

This agent is different from the Streamlit UI itself. The UI remains a deterministic application surface, while the UI Guidance Agent helps users understand what to do next.

Responsibilities:

- Explain the current screen and next action.
- Help the user create a bid or request-for-quote.
- Suggest missing bid details or quote-upload requirements.
- Recommend decision criteria templates.
- Summarize agent status and run progress in plain business language.
- Explain bid results and why a quote won or lost.
- Help the user drill down from bid-level results into quote-level analysis.
- Ask clarifying questions when the input is incomplete.

The UI Guidance Agent should not:

- Save files directly.
- Modify `bids_database.csv` or output artifacts directly.
- Bypass the orchestrator.
- Make final procurement decisions independently.
- Dynamically generate arbitrary UI code.

For the first implementation, this can remain a future component. The practical UI should still use deterministic screens for bid intake, quote uploads, run monitoring, results, and quote detail.

---

### 5.3 Customer / Requirement Intake Agent

This agent captures and clarifies the business requirement.

Responsibilities:

- Understand the business decision being reviewed
- Identify missing input fields
- Convert unstructured input into structured workflow data
- Ask clarifying questions where required
- Select the appropriate workflow template

For the weekend demo, this can remain simple or partially mocked.

---

### 5.4 Orchestrator / Manager Agent

The orchestrator is the central controller of the workflow.

Responsibilities:

- Receive structured business input
- Select the workflow template
- Decide which agents should run
- Pass relevant data to each agent
- Trigger parallel execution where possible
- Wait for responses
- Handle missing or failed agent outputs
- Send consolidated agent outputs to the evaluator
- Prepare the final decision package for the UI

The orchestrator should behave like a human manager assigning work to specialists.

For the next implementation step, the orchestrator can be a lightweight controller that calls existing agents and returns structured intermediate states to the UI.

---

### 5.5 Parallel Execution Layer

This is not a business agent. It is a system layer used by the orchestrator.

Responsibilities:

- Run independent agent calls in parallel
- Track agent status
- Handle timeouts
- Support retries
- Return partial results if some agents fail
- Prevent one slow agent from blocking the full workflow

This layer helps justify the use of Agentic AI because the system is not just a single sequential LLM call.

---

### 5.6 Specialist Agents

Specialist agents should be generic enough to support multiple business workflows, while still allowing domain-specific adapters.

#### Minimal Specialist Agents for Demo

##### 1. Contract / Terms Agent
Contract Review Agent

The current PreMortem implementation can evolve into this component.

Responsibilities:

- Contract analysis
- Clause extraction
- Warranty review
- Payment milestone review
- Installation responsibility review
- Commercial risk assessment
- Contract-submission quality review
- Identification of missing, vague, conflicting, extra, or unusual contract terms
- Assessment of whether contract and commercial claims are evidence-backed
- Detection of proposal language that is mostly marketing rather than operationally specific
- Identification of vendor differentiators that affect contract execution risk
- Follow-up questions needed before award or negotiation

The Contract Review Agent should analyze the vendor submission, not only fixed procurement fields. When raw quote text is available, it should treat the raw document text as the primary source and use fixed fields only as context or fallback.

Contract Review Agent should explicitly capture:

- What the vendor emphasizes in the contract/commercial submission.
- What the vendor avoids saying or leaves unclear.
- How specific the implementation, installation, warranty, service, and training commitments are.
- Whether important claims are supported by evidence in the document.
- Whether the quote is substance-heavy, marketing-heavy, or mixed.
- Unusual conditions, exceptions, exclusions, or commercial terms.
- Differentiators that reduce or increase contract execution risk.
- Whether the proposal appears mature, vague, incomplete, or risky.
- Follow-up questions required before a final procurement decision.

If fixed fields conflict with raw quote text, the agent should report the conflict instead of silently choosing one source.


##### 2. Cost / Benchmark Agent

Checks:

- Quoted cost against historical purchases
- Vendor price against benchmark ranges
- Cost-to-value justification
- Possible overpricing or rate inflation

This should eventually support supplier value-to-cost benchmarking, not only lowest-price comparison.

##### 3. Operational Readiness Agent

Checks whether the business is ready to execute the decision after approval.

For MRI procurement, this includes:

- Site readiness
- Electrical readiness
- Regulatory approvals
- Technician availability
- Training readiness

This agent can also support checklist generation and procedure updates.

##### 4. Vendor / Proposal Understanding and External Risk Agent

This agent owns vendor and proposal understanding. It should extract information from the vendor quote document and produce a reusable schema that can be passed to Contract Review, Cost Benchmark, Compliance, Vendor Risk, Bid Recommendation, and Evaluator agents.

The agent should not only parse fixed fields. It should preserve proposal-level intelligence that a human reviewer would use when judging vendor submissions.

Document extraction responsibilities:

- Read raw extracted text from vendor quote PDFs.
- Extract core comparable fields where possible.
- Capture vendor profile information, references, certifications, service claims, and differentiators.
- Capture what the vendor emphasizes.
- Capture what the vendor omits, avoids, or leaves vague.
- Identify extra information that may be useful for evaluation.
- Identify unusual claims, unusual terms, exceptions, or conditions.
- Assess evidence quality and specificity.
- Separate explicitly stated facts from inferred or unclear information.
- Attach evidence snippets to extracted fields and observations.
- Produce follow-up questions for missing or ambiguous proposal information.

The first implementation should use a deterministic document parser before the Vendor / Proposal Understanding Agent:

```text
PDF bytes
  -> deterministic parser extracts text
  -> Vendor / Proposal Understanding Agent interprets the extracted text
```

This is preferred for the demo because it is faster, cheaper, easier to debug, and produces auditable text that can be reused by multiple agents. The Vendor Agent should focus on interpretation and proposal intelligence, not low-level PDF byte parsing.

If deterministic extraction quality is poor, the system can later fall back to a document-capable LLM, OCR, or vision-based extraction path. This may improve accuracy for scanned PDFs, complex tables, multi-column layouts, stamps, signatures, or image-heavy quote documents.

The proposal artifact should therefore track extraction metadata such as:

- extraction method
- text character count
- text preview
- extraction quality
- whether OCR or vision fallback is needed

Current implementation status:

- Deterministic PDF text extraction exists.
- Vendor / Proposal Understanding Agent is designed but not implemented yet.
- Until the Vendor Agent is implemented, the Contract Review Agent reads `raw_document_text` directly.

External/vendor-risk responsibilities:

- Vendor performance
- Delivery history
- Reputation
- Litigation or dispute indicators
- External risk signals

This is related to competitor/vendor research, but should be framed more broadly as external risk intelligence.

Output should include both:

1. Comparable structured fields for fair quote comparison.
2. Open proposal observations that preserve vendor-specific richness.

The Vendor / Proposal Understanding and External Risk Agent should not make the final quote recommendation. It prepares structured, evidence-backed inputs for downstream specialist agents and the Bid Recommendation Agent.

##### 5. Compliance / Policy Agent

Checks:

- Internal policy compliance
- Audit readiness
- Regulatory requirements
- Restricted-domain requirements
- Privacy or governance requirements

This may be important for government, restricted-domain, or enterprise procurement use cases.

##### 6. Bid Recommendation Agent

The Bid Recommendation Agent is the decision integrator for a bidding process. It compares multiple vendor quotes within one bid and recommends the best quote or shortlist.

This agent should not perform every analysis itself. It should consume structured outputs from specialist agents and external-signal agents, then synthesize a final ranking.

Current demo inputs:

- Quote PDFs and extracted quote text.
- Vendor / Proposal Understanding and External Risk Agent outputs when available.
- Contract Review Agent outputs.
- Dataset metadata such as weighted decision score, rank, and ground-truth labels for evaluation.
- Management criteria and weights where available.

Future inputs:

- Cost / Benchmark Agent outputs.
- Compliance / Policy Agent outputs.
- Vendor / External Risk Agent outputs.
- Internet / Market Research Agent outputs.
- Historical procurement examples.
- Human reviewer comments or overrides.

Expected output:

- Winning quote.
- Ranked quote list.
- Top 2 / top 3 / top 5 shortlist.
- Selection rationale.
- Rejection or downgrade reasons for weaker quotes.
- Negotiation points.
- Risks that require human review.
- Confidence score.

The Bid Recommendation Agent is different from the Decision Summary Agent:

- Bid Recommendation Agent decides which quote is best within a bid.
- Decision Summary Agent converts evaluator-approved results into a business-friendly report and approval package.

The first implementation can use a simple ranking strategy based on Contract Review Agent outputs and dataset metadata. Later, the same agent input schema can accept internet, vendor, benchmark, compliance, and historical signals without changing the UI or graph API contract.

---

### 5.7 Evaluator Agent

The evaluator reviews the overall quality of the workflow.

Responsibilities:

- Check whether all required agents completed
- Check if findings are consistent
- Identify missing evidence
- Identify conflicting recommendations
- Evaluate whether conclusions are supported by data
- Estimate confidence
- Flag weak or cosmetic outputs
- Decide whether the final report is ready for human review

This is important because the system should not only generate content; it should also monitor the quality and reliability of its own workflow.

---

### 5.8 Decision Summary Agent

The Decision Summary Agent converts the evaluator-approved outputs into a business-friendly decision package.

Final output should include:

- Go / No-Go / Conditional Go
- Overall risk score
- Key risks
- Supporting evidence
- Missing information
- Recommended next actions
- Agent-level status
- Confidence score
- Approval conditions
- Follow-up tasks

---

### 5.9 UI Dashboard

The UI should show the agentic workflow, not just the final answer.

Suggested UI sections:

- Business input summary
- Workflow selected
- Orchestrator status
- Agent execution cards
- Agent findings
- Evaluator feedback
- Final decision
- Risk score and confidence
- Recommended actions
- Future workflow placeholders

The UI Guidance Agent can sit alongside this dashboard later as an assistant that explains what the dashboard means and recommends the next user action. The dashboard itself should remain deterministic and backed by orchestrator state and output artifacts.

Even if not all workflows are implemented, the UI can show the intended expandable architecture.

---

## 6. Additional Future Agents

The architecture can later include:

- Customer Requirements Interface Agent
- UI Guidance Agent
- Internet / External Data Collection Agent
- Internet / Market Research Agent
- Competitor Research Agent
- Bid Recommendation Agent
- Compliance Enforcement Agent
- Privacy Management Agent
- Email / Communication Analysis Agent
- Connection Management Agent
- Agent Operation Cost Management Agent
- Contract Review Agent
- Continuous Monitoring Agent

These should not all be implemented immediately. They are useful for showing long-term extensibility.

### Internal Communication Agent

Responsible for enterprise communication and collaboration.

Potential integrations in Connection:

- Slack
- Teams
- Email
- Ticketing Systems
- ERP Systems

This agent enables interaction with enterprise workflows and approvals.

---

## 7. Why This Better Addresses Agentic AI

The revised architecture demonstrates:

- Orchestration
- Parallel agent execution
- Role-based agents
- Workflow state tracking
- Evaluation and quality monitoring
- Structured decision output
- Extensibility across multiple business workflows
- Clear separation between generic framework and domain-specific implementation

This is stronger than a single-agent analysis demo.

---

## 8. Short-Term Weekend Demo Plan

### Must Implement

1. Orchestrator controller
2. Parallel calls to at least 3 existing agents
3. Common `AgentResult` format
4. Evaluator dummy or initial implementation
5. UI showing agent states and final decision
6. Clear final Go / No-Go / Conditional Go output

### Nice to Have

1. Vendor benchmark agent
2. Dataset-backed examples
3. Workflow selector in UI
4. Agent confidence scoring
5. Human approval step
6. Basic agent cost tracking

### Avoid for Now

1. Full enterprise workflow
2. Large dataset training
3. Complex MCP implementation
4. Memory optimization
5. Perfect generic framework
6. Overly specialized agent design

---

## 9. Dataset and Experiment Direction

A small static example can make the demo look cosmetic if the output appears pre-decided.

To improve credibility, the team should consider:

- More sample procurement cases
- Historical benchmark examples
- Positive and negative examples
- Expected outputs for comparison
- Evidence-backed agent findings
- Simple evaluation of agent output quality

The evaluator agent can help here by checking whether each agent output contains evidence and actionable recommendations.

---

## 10. Suggested Task Split

### Chinmaey

- Create high-level architecture notes
- Propose generic workflow model
- Prototype orchestrator / manager controller
- Show how existing PreMortem agents can be controlled by the orchestrator
- Add initial evaluator concept or dummy evaluator
- Help align the architecture with OpenAI workspace-agent concepts

### Anvith / Team

Option 1: Dataset and Experiment Design

- Improve sample dataset
- Add realistic cases
- Make outputs evidence-driven
- Avoid purely cosmetic demo behavior

Option 2: UI Architecture

- Build UI to show agent workflow
- Add agent status cards
- Add progress and intermediate outputs
- Add evaluator feedback panel
- Show expandable future workflows

---

## 11. Positioning

Do not discard the PreMortem idea.

Reframe it:

> PreMortem AI is the first workflow running on a generic agentic business decision review framework.

MRI procurement is the first demo scenario.

The long-term platform is a reusable agentic business decision auditor.

---

## 12. One-Line Vision

PreMortem AI uses orchestrated specialist agents to simulate a business review board before high-risk decisions are approved.

---

## 13. Practical Weekend Goal

The goal for the weekend should not be to build the full platform.

The goal should be to show:

```text
Input decision
   ↓
Orchestrator assigns work
   ↓
Multiple agents run
   ↓
Evaluator reviews quality
   ↓
Decision summary appears in UI
```

If this flow is visible, the demo will better justify the use of Agentic AI.

## Key Takeaway

A single LLM can solve a business problem.

An Agentic AI platform demonstrates additional value through:

- Orchestration
- Specialization
- Tool usage
- Evaluation
- Collaboration among agents
- Workflow governance

The goal of the architecture is not merely to generate recommendations, but to simulate a structured business review process.
