---
type: okf-memory-index
title: Internet Market Research Agent Memory Index
description: Entry point for OKF-style memory used by the internet market research agent.
resource: internet_market_research_agent
status: draft
tags:
  - internet-research
  - market-benchmark
  - web-search
  - memory
---

# Internet Market Research Agent Memory Index

This folder stores durable guidance for the Internet / Market Research Agent.
The first implementation should use OpenAI Responses API `web_search` and later
allow an MCP search provider behind the same service interface.

## Read Order

1. Read `profile.md` for role, boundaries, and expected outputs.
2. Use `policies/web-search-provider.md` for provider behavior.
3. Use `policies/source-quality.md` for source handling and limitations.
4. Use `policies/benchmark-fields.md` for benchmark schema expectations.
5. Use `patterns/market-red-flags.md` for recurring procurement research signals.

## Memory Boundaries

- Return structured benchmark signals, not raw web pages.
- Include source URLs and retrieval timestamp when available.
- Treat internet research as context, not proof.
- Do not override current bid evidence, management criteria, contract review, or compliance blockers.
