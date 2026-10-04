# 03 — Model provider & agent runtime

Goal: agents depend on an interface, not a vendor. Runs with no key.

## Phase 1 — Interface + stub
### Tasks
- [ ] `ModelProvider { complete({messages, tools?, responseSchema?, images?}) }` — one primitive for structured output, tool calls and vision
- [ ] `StubProvider`: scripted responses keyed by sample file (`data/sample-leases/expected.json`, `data/sample-photos/expected.json`); simple parser for typed corrections ("rent is 8500")
- [ ] Select provider from env (`OPENROUTER_API_KEY` unset → stub)
### Results
-

## Phase 2 — Agent loop + tools
### Tasks
- [ ] Tool registry: name, Zod args, handler; args validated, errors returned to the model
- [ ] Loop: model → tool calls → results → model, max ~6 steps; ends on `ask_user` or final reply
- [ ] Log each tool call (name, args, result, ms) against the message
### Results
-

## Phase 3 — OpenRouter
### Tasks
- [ ] OpenAI SDK with OpenRouter base URL; tool calling, JSON-schema output, image input
- [ ] One retry on invalid JSON, then clear error
- [ ] Log model, tokens, latency per call
### Results
-
