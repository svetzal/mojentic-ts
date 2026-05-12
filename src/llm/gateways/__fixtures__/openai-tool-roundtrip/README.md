# OpenAI Tool Round-trip Fixtures

These fixture files are **byte-identical across all mojentic ports**:

- mojentic-py (Python)
- mojentic-ts (TypeScript)
- mojentic-ex (Elixir)
- mojentic-ru (Rust)

**Changing one requires changing all four.**

The fixtures represent a canonical two-turn `get_weather` tool round-trip scenario used in parity-protective integration tests. They ensure that all ports handle the OpenAI tool-call/tool-result message sequence identically.

## Files

- `response-1-tool-call.json` — First LLM response requesting the `get_weather` tool for Paris
- `response-2-final.json` — Final LLM response after receiving the tool result
- `tool-result.json` — The weather data returned by the `get_weather` tool
