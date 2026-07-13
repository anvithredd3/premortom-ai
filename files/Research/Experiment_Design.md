# Experiment Design

## Introduction

The experiment design extends the current single-procurement PreMortem demo into a repeatable evaluation process for quote comparison and agentic decision quality.

The goal is to test whether the pipeline can evaluate multiple vendor quotes for the same bidding process, rank or shortlist the best options, and match known ground truth decisions. This helps measure not only whether one demo answer looks reasonable, but whether the full agentic workflow can make consistent procurement decisions across many bidding scenarios.

The experiment should evaluate:

- How well the system ranks vendor quotes.
- Whether the selected top quote matches the expected winner.
- Whether the correct quote appears in the top 2, top 3, or top 5 shortlist.
- Which agents contribute most to good or bad decisions.
- How criteria weights affect quote ranking.
- Runtime, token usage, cost, and observability of the pipeline.

## Decision Criteria

There are many possible procurement decision criteria for a small or medium hospital. Some are currently represented in the app through risk agents, while others are business-facing criteria that may need to be added for quote comparison.

## Top 10 Candidate Criteria

1. Clinical fit and specification match.
   Measures whether the quote meets the hospital's actual clinical need, expected patient volume, specialty use cases, required features, and workflow.

2. Total cost of ownership.
   Includes purchase price, installation, AMC/CMC, consumables, spares, software licenses, upgrades, energy cost, and downtime cost.

3. Service and maintenance readiness.
   Evaluates local service availability, response time, spare parts access, uptime commitment, warranty support, and escalation process.

4. Infrastructure readiness and installation feasibility.
   Checks whether the hospital has space, power, HVAC, shielding, approvals, IT/networking, and site readiness for installation.

5. Training and workforce readiness.
   Evaluates whether doctors, technicians, biomedical staff, and operators can safely and effectively use the equipment.

6. Strategic business value.
   Considers expected revenue, patient demand, referral growth, competitive positioning, future specialty expansion, and hospital brand impact.

7. Vendor reliability and past performance.
   Reviews delivery history, references, service track record, financial stability, and experience with similar hospitals.

8. Financial terms and payment risk.
   Considers advance payment, milestone payments, warranty start date, penalties, financing, buyback, and cancellation clauses.

9. Brand reputation and market acceptance.
   Includes international or local brand trust, clinician confidence, patient perception, resale value, and marketability.

10. Regulatory and compliance fit.
    Checks certifications, local approvals, safety standards, documentation, warranty enforceability, and audit readiness.

## Recommended Top 5 Criteria

For the first experiment, the recommended top five criteria are:

1. Clinical fit and specification match.
   This should be the first criterion because the equipment must solve the actual medical need. A low-cost or famous product is still a poor choice if it does not fit the hospital's clinical use case.

2. Total cost of ownership.
   Small and medium hospitals are sensitive to hidden costs. The experiment should capture whether a quote that looks cheaper upfront becomes more expensive due to consumables, service, software, downtime, or upgrades.

3. Service and maintenance readiness.
   Uptime is critical in a hospital. Local support, spare parts, fast response, and warranty execution can matter more than brand name, especially outside large metro areas.

4. Infrastructure and workforce readiness.
   Many procurement failures happen because the site, approvals, operators, or support staff are not ready. This criterion connects directly to the existing PreMortem risk agents.

5. Strategic business value.
   Hospitals may choose equipment to grow a service line, attract doctors, increase referrals, improve patient confidence, or compete in the local market. If service and maintenance readiness are already strong, strategic business value deserves a top-five position.

Vendor reliability and contractual risk should remain as a guardrail. It may not be one of the top weighted business criteria in this experiment, but serious red flags in vendor delivery history, payment terms, warranty start date, or contract clauses should downgrade or block a quote.

## Vendor Quote Format Assumptions

The criteria collected on Screen 1 can be treated as bid criteria published by the hospital or procuring organization. However, the experiment should not assume that every vendor quote will follow those criteria exactly.

In real procurement, vendors may:

- Address only the criteria that make their quote look strong.
- Omit details that do not suit them.
- Add extra features, services, financing options, or differentiators.
- Include company profile, history, certifications, client references, and service network details.
- Use different terminology for the same concept.
- Provide information in different sections of the document instead of a structured table.
- Leave some values implicit or ambiguous.

For the experiment, quote inputs should therefore include both structured fields and document-style text. The extraction and analysis pipeline should be tested on its ability to identify missing information, infer relevant evidence, and flag unsupported claims.

Typical quote document assumptions:

- Quotes are commonly submitted as PDF files.
- Each quote may have a standard bidding format, but vendors may still vary the structure.
- Quote length may vary by vendor and equipment type.
- Documents may include cover letter, company profile, technical specification, commercial offer, compliance statement, warranty terms, service support details, and annexures.
- The system should not require every quote to contain every expected field in the same order.

The experiment should include variations where quotes are complete, partially complete, overly promotional, compliance-heavy, price-heavy, and service-heavy.

For the actual pipeline experiment, the primary quote input should be PDF files, not only JSON records. JSON can still be used for metadata, criteria, labels, and ground truth, but the agentic pipeline should process the quote PDFs so the document extraction and missing-information handling are evaluated realistically.

The generated or collected PDF quote files should be stored in a shared location hosted through a web server. Each quote record in the experiment metadata should include a stable URL or path to its PDF file. This allows the backend pipeline to retrieve the same quote documents consistently during local demo runs, batch evaluation, and future hosted experiments.

Recommended structure:

- Shared PDF location: hosted folder or web server path for quote documents.
- Metadata file: bid id, quote id, vendor name, criteria weights, PDF URL, and ground truth labels.
- Pipeline input: PDF URL or PDF path plus bid-level criteria.
- Pipeline output: extracted fields, agent reasoning, quote ranking, and decision metrics.

## 100 x 20 Experiment Design

The proposed evaluation dataset is:

- 100 bidding processes.
- 20 vendor quotes per bidding process.
- 2,000 total quotes.
- Ground truth for each bidding process, such as top 1, top 2, top 3, or top 5 expected choices.
- 2,000 PDF quote documents stored in a shared web-hosted location, with metadata linking each quote to its PDF.

Each bidding process should represent one procurement need, such as an MRI machine, CT scanner, ultrasound system, lab analyzer, ICU equipment, or hospital IT system. Each process should include 20 competing vendor quotes with different prices, specifications, service terms, delivery timelines, infrastructure assumptions, warranty terms, and business value.

## Reasoning For 100 Bids

100 bidding processes is large enough to provide meaningful evaluation across different procurement situations, while still being small enough to explain and manage during a hackathon or early prototype phase.

With only a few bidding processes, the evaluation may look like a hand-picked demo. With 100 processes, the team can start measuring repeatability, failure patterns, and agent behavior across a broader sample.

## Reasoning For 20 Quotes Per Bid

20 vendor quotes per bidding process is a realistic stress test for quote comparison. It forces the system to rank many alternatives instead of simply choosing between two or three obvious options.

This design tests whether the agents and decision board can handle:

- Similar quotes with small differences.
- Cheaper quotes with hidden risk.
- Expensive quotes with better long-term value.
- Strong brands with weak local service.
- Local suppliers with better maintenance support.
- Quotes that meet product specifications but fail business criteria.

20 quotes also supports top-k evaluation. The system can be tested on whether it selects the exact winner, or whether it includes the correct quote in the top 2, top 3, or top 5 shortlist.

## Evaluation Method

For each bidding process:

1. Load all 20 vendor quotes.
2. Load the management criteria and weights.
3. Run the quote analysis agents.
4. Run market or internet research where available.
5. Generate debate and decision board reasoning.
6. Produce a ranked quote list.
7. Compare the output with ground truth.

Recommended metrics:

- Top-1 accuracy.
- Top-2 recall.
- Top-3 recall.
- Top-5 recall.
- False acceptance rate.
- False rejection rate.
- Average rank of the ground-truth winner.
- Agent disagreement rate.
- Runtime per bid.
- Token usage and cost per bid.

## Safe Demo Evaluation Limits

The full experiment target is 100 bids x 20 quotes, but the default backend test runner should not execute the full dataset. This protects demo runs from accidentally consuming too many LLM tokens or taking too long.

Default backend evaluation test limits:

- Maximum 2 bids.
- Maximum 5 quotes per bid.
- Offline/fallback agent behavior for local safety unless intentionally configured otherwise.

Run the capped backend evaluation test:

```bash
RUN_BID_EVAL_TESTS=1 python -m unittest backend.tests.test_bid_evaluation
```

Run one bid only:

```bash
RUN_BID_EVAL_TESTS=1 BID_ID=BID-001 python -m unittest backend.tests.test_bid_evaluation
```

or:

```bash
RUN_BID_EVAL_TESTS=1 BID_NUMBER=1 python -m unittest backend.tests.test_bid_evaluation
```

When the team is ready to run a larger evaluation using the HCL enterprise account, explicitly override the limits:

```bash
MAX_BIDS=10 MAX_QUOTES_PER_BID=20 RUN_BID_EVAL_TESTS=1 python -m unittest backend.tests.test_bid_evaluation
```

The large run should be treated as a deliberate experiment execution, not as a default local test.

## Agentic Workflow Evaluation Criteria

The experiment should evaluate not only whether the system picked the right quote, but also whether the agentic workflow is reliable, explainable, and useful for procurement decisions.

### Decision Quality

- Top-1 accuracy: whether the pipeline selected the correct winning quote.
- Top-2 or top-3 recall: whether the correct quote appeared in the shortlist.
- Ranking quality: how close the full ranking was to the expert or ground-truth ranking.
- False acceptance: whether the system approved or shortlisted a risky quote.
- False rejection: whether the system rejected a good quote.

### Reasoning Quality

- Evidence grounding: whether agent conclusions are backed by quote text or source evidence.
- Missing-info detection: whether the system flags important details that vendors omit.
- Consistency: whether the same input produces similar decisions across repeated runs.
- Explainability: whether a human reviewer can understand why a quote won or lost.
- Hallucination rate: whether agents invent facts not present in the quote or supporting sources.

### Agent Collaboration

- Agent disagreement quality: whether disagreements between agents are meaningful and useful.
- Decision board quality: whether the final decision fairly combines agent inputs.
- Conflict resolution: whether the system handles tradeoffs such as cheap but risky, expensive but high-value, or strong brand with weak local service.
- Agent contribution: which agents changed the final ranking or final decision the most.

### Business Fit

- Criteria-weight alignment: whether the output reflects the management-defined criteria weights.
- Strategic value sensitivity: whether the system recognizes long-term business benefit.
- Compliance handling: whether the system catches missing standards, certifications, and regulatory requirements.
- Market comparison quality: whether market or internet research is used appropriately where available.

### Operational Metrics

- Time per bid.
- Token usage per quote.
- Cost per bid.
- Failure and retry rate.
- Human override rate.
- Review time saved.

For this use case, the highest-priority evaluation criteria are:

1. Top-k shortlist accuracy.
2. Evidence grounding.
3. Missing-info detection.
4. Criteria-weight alignment.
5. False acceptance rate.

These five criteria help determine whether the system is useful, trustworthy, and safe for procurement decision support.

## Sample Selection Criteria For 2,000 Quotes

The 100 x 20 experiment creates 2,000 quote examples. These examples should not be selected only through random generation. The sample should be balanced, realistic, and include edge cases that test the quality of the agentic decision pipeline.

Recommended selection criteria:

1. Cover all major risk levels.
   The dataset should include low-risk, moderate-risk, high-risk, and critical-risk quotes so the pipeline can be tested across the full decision range.

2. Cover the top five decision criteria.
   The quotes should vary across clinical fit, total cost of ownership, service and maintenance readiness, infrastructure and workforce readiness, and strategic business value.

3. Include realistic hospital scenarios.
   The combinations should represent situations that small and medium hospitals actually face, not only mathematically possible but unrealistic combinations.

4. Include important edge cases.
   Examples include low price with poor service, strong brand with weak local support, high strategic value with poor infrastructure readiness, technically compliant quotes with financial risk, and good quotes where warranty starts too early.

5. Balance winners and losers.
   Each bidding batch should include a clear ground-truth winner, a close runner-up, acceptable alternatives, weak quotes, and risky quotes.

6. Cover vendor types.
   The dataset should include international premium brands, local suppliers with strong support, low-cost vendors, refurbished or older model suppliers, and new entrants with limited history.

7. Cover procurement sizes.
   Include low, medium, and high contract values so the pipeline is not tuned only to one budget range.

8. Cover operational readiness states.
   Include hospitals that are ready, partially ready, and not ready in terms of site, approvals, workforce, and supporting infrastructure.

9. Cover contract and payment patterns.
   Include low advance payment, high advance payment, milestone-based payment, warranty on delivery, warranty on commissioning, buyer installation, vendor installation, and shared installation responsibility.

10. Avoid duplicate-looking combinations.
    If two quotes are almost identical across all major fields and criteria, keep only one unless the purpose is to test small ranking differences.

Recommended composition for each 20-quote bidding batch:

- 1 top ground-truth winner.
- 1 close runner-up.
- 3 strong contenders.
- 5 average or acceptable quotes.
- 5 high-risk quotes.
- 5 edge-case quotes.

This composition gives each bidding process a realistic ranking problem. It also tests whether the system can identify the best quote, preserve good alternatives in the shortlist, and reject risky options for the right reasons.

## Controlled Randomness

The synthetic dataset should use controlled randomness, not pure random generation. Pure randomness may create unrealistic quote combinations that do not represent real hospital procurement.

The generator should randomize important fields such as equipment type, hospital type, city tier, readiness states, vendor type, quote archetype, quote format, contract value, delivery timeline, advance payment, warranty start, installation responsibility, training inclusion, service response time, local service availability, compliance completeness, and criteria scores.

At the same time, the dataset should preserve structure:

- 100 bidding processes.
- 20 quotes per bidding process.
- Known archetype mix per bid.
- Top 10 candidate criteria.
- Weighted top 5 decision criteria.
- Ground truth top-1 and top-2 labels.
- Coverage tracking across important criteria and input dimensions.

This balance gives enough variation to test the agentic workflow, while keeping the samples realistic and explainable.

## Hackathon Positioning

The 100 x 20 experiment is an ambitious but useful target. For a live hackathon demo, the team can show a smaller slice, such as 5 to 10 bidding processes with 5 to 10 quotes each.

The full 100 x 20 design can be presented as the evaluation framework that proves the pipeline can scale beyond a single impressive demo case.

## Current Docker Validation Slice

For the current demo build, the minimum Docker validation should cover one quote
end-to-end and then verify the newer agent artifacts and history tables.

Recommended sequence:

1. Start Docker services with the database and backend.
2. Run one bid evaluation for `BID-001` with one quote.
3. Confirm the run creates or updates a `RUN-*` folder.
4. Confirm `vendor_proposal_agent_quote_intelligence.json` exists for the run.
5. Call the RFQ / Negotiation Guidance API using that vendor proposal artifact.
6. Confirm `decision_history` and `decision_history_chunks` increased.
7. Confirm `agent_history` and `agent_history_chunks` include the expected
   agents, including UI Guidance after the API/helper run.

Minimum current agents to check in history:

- `vendor_proposal_agent`
- `contract_agent`
- `internet_market_research_agent`
- `bid_recommender_agent`
- `ui_guidance_agent`

The Invoice Monitoring and Contract Compliance Agent is design-stage only, so it
should not be expected in Docker history tables until its implementation starts.
