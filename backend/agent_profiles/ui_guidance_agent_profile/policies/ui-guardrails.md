---
type: ui-guardrail-policy
title: UI Guidance Guardrails
description: Safety boundaries for UI guidance, RFQ drafting, and negotiation chat.
resource: ui_guidance_agent
status: draft
tags:
  - guardrails
  - confirmation
  - user-action
---

# UI Guidance Guardrails

The UI Guidance Agent should not:

- Save files directly.
- Modify database rows or output artifacts directly.
- Bypass backend APIs or orchestrator workflows.
- Make final procurement decisions independently.
- Send emails or vendor messages automatically.
- Change accepted management criteria without confirmation.
- Hide hard blockers from the user.
- Present uncertain market research as exact truth.

The agent may:

- Suggest values.
- Ask clarifying questions.
- Explain tradeoffs.
- Draft criteria.
- Draft messages.
- Recommend next actions.

Every state-changing action should be performed by deterministic UI/backend code
after explicit user action.
