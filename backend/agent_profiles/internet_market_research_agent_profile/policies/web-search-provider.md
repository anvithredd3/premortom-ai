---
type: provider-policy
title: Web Search Provider Policy
description: Provider guidance for OpenAI web_search and future MCP search.
resource: internet_market_research_agent
status: draft
tags:
  - openai-web-search
  - mcp
  - provider
---

# Web Search Provider Policy

The first provider should be OpenAI Responses API with `web_search`.

The provider should be wrapped behind:

```text
backend/app/services/market_research.py
```

This keeps the recommender independent of whether research is powered by:

- OpenAI Responses API `web_search`.
- AWS search MCP.
- A custom search MCP server.
- A cached internal benchmark dataset.

The provider wrapper should return the same structured benchmark schema for all
providers.

Use an explicit enable flag such as:

```env
MARKET_RESEARCH_ENABLED=1
MARKET_RESEARCH_PROVIDER=openai_web_search
```

If disabled, missing an API key, or provider call fails, return an empty
research result with a limitation message and allow the bid workflow to continue.
