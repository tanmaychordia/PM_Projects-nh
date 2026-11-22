# Project memory

## Product intent & audience

- Voice-of-customer (VOC) analysis engine that classifies customer reviews/feedback into domains (booking, app, support) and produces actionable recommendations.
- Designed for multi-complaint reviews — clause-level matching so one review can surface multiple issues.

## Brand personality & voice

- Not yet inferred from UI/marketing context.

## Visual design & UX direction

- Not yet inferred; current work centers on the analysis-engine library, not UI.

## Decisions, constraints & rationale

- Classifier lives in `lib/voc/analysis-engine.ts`; do not modify or rewrite it unless explicitly requested.
- Category rules use `excludeUnless` guards to prevent over-broad matching (e.g., booking only when guard passes).
- Domain preference separates "booking" from "app" complaints — keywords/context disambiguate which is intended.
- Positive-experience triggers and sentiment detection were rebalanced to avoid false positives and improve sentiment accuracy.
- Support can be co-assigned alongside other complaint categories in a single review.
- `booking_availability` rule block is critical: includes keyword lists, `excludeUnless` guard, and full recommendation config (title, problem, action, rationale, horizon, success metric).
- Regression tests in `tests/analysis-engine.test.ts` cover booking/app separation, multi-complaint reviews, support co-assignment, sentiment balance (9 scenarios added).
- Test counts: 49 analysis-engine tests; 244 audit-package tests — both must remain green.

## Open questions & assumptions

- No `.bolt/prompt` exists yet; if one is added, it becomes authoritative for global instructions.
- UI/UX direction not established — may need design guidance when frontend work begins.
- Booking vs. app disambiguation relies on keyword/context heuristics; edge cases may require tuning over time.