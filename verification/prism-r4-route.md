# FA-87 — Prism R4 route

Authority: the Prism R4 decision, `studio/shell/r4/spec.json`, which is afflom/me's `app/specs/r4/spec.json` at 28dca52, byte for byte (SHA-256 `808b936a…b254`). There its seven guarantees are proved by Lean in `app/src/PrismR4.lex.tex`.

The idea box and the chat answer with Foundry's own language and reasoning only: the model in Prism on this device. `studio/shell/r4.mjs` states the facts of a turn as an R4 request and decides it with prism-code's `judge`, first match. It holds no rule of its own.

- Before any request is looked up or made, the route is decided. Foundry's grant is empty, so a route to any other model is `routed … ungranted` and refused. No cloud request, consent dialog or provider key step is reached.
- After the device model answers and before its answer is sealed or applied, R4 decides again with the weights fact (the loader read the weights back by their verified image address, `loaded.imageKappa`) and the engine's own address from the receipt.
- The studio lists and defaults to the device model only. A stored cloud selection is moved to the device model by one write of the settings record when the settings are read; the chat route itself never substitutes a model (FA-81).

The cloud warm-up, the paid branch and the paid-model repair turn are gone from a chat turn, with the two tests of that repair turn.

## Local evidence

`node --test studio/tools/prism_r4_route.test.mjs`: 6 of 6 pass. Every one of the spec's 18 examples is judged as stated, plus `r4:lexlean-r4` `inprism` archive/weights pin verification (`studio/shell/r4/lexlean-r4.json`).

Planted defects, each refused, then restored:

- A grant naming `featherless`: test 2 fails, the routed turn is no longer refused.
- The pre-request R4 decision removed from `chatTurn`: test 4 fails.
- Returning `weights: "match"` when `weightsState` is missing in `r4InprismFacts` (`studio/shell/r4.mjs`): test 6 fails (`REQ-005` refusal bypassed).

The suites that read the host's text and were touched pass: `browser_telemetry_isolation`, `generation_patch`, `live_main_integration`, `notation_host_integration`, `read_only_chat_execution`.

# FA-95 — Bundled `.holo`, dual weights pins & disclosure consent

- Bundled artifact: `studio/shell/r4/0794a3dd255aaedd2e1e1be626326b45e36510fa2d1170265a19c52c76c4ceea.holo` (`12,762,112` bytes `<= 32 MiB`), pinned in `studio/shell/r4/lexlean-r4.json` alongside `qwen3WeightsKappa` (`sha256:1d0255929995725be144cb1787416880ffb073e0d153adf1a663abb636a0550a`) and `offlineQ31WeightsKappa` (`sha256:2d13022e5a2aec26f7e023bf7524277eb7f2bfa9b3eaad37fc35655cb1790176`).
- Lazy caching: `studio/shell/sw.template.js` (`self.__shellLazy = (p) => /^r4\/.*\.holo$/.test(p)`) and `studio/shell/shell-cache.js` (`ShellClosure.verifyFile`) keep `r4/*.holo` out of first-paint install while retaining complete SHA-256 verification and the `<= 32 MiB`/file, `<= 128 MiB` closure bounds (`studio/shell/manifest.json` projects 191 files, `28,519,555` bytes).
- Consent gates: `studio/shell/preview-permissions.mjs` shares one parameterized `makeDialog` + `askReviewDialog` native `<dialog>` helper across `"Review preview permissions"`, `"Review R4 model weights download"`, and `"Review SpiralCore internet access"`, persisting outcomes to IndexedDB `refs` + `audit`.

Planted defects, each refused, then restored:

- Returning `weights: "match"` unconditionally for non-missing weights in `r4InprismFacts` (`studio/shell/r4.mjs`): `node --test studio/tools/prism_r4_route.test.mjs` fails test 6 (`AssertionError [ERR_ASSERTION]: unpinned`, `'answer' !== 'refuse'`) and `cargo test --locked -p repo-conformance --test prism_r4_route` fails both `prism_r4_route_fa_87` and `prism_r4_route_fa_95`.
- Appending `allow` before `deny` in `askReviewDialog` (`studio/shell/preview-permissions.mjs`): `node --test studio/tools/shell_ui.test.mjs` fails test 9 (`R4 weights download and SpiralCore internet access share the native dialog contract (FA-95)`).
