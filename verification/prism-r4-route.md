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

# FA-96 — Streaming `inprism` authoring, `/workspace` sync & native `terminal:*`

- Command ownership & R5 boundary: `app/src/FoundrySpecification.lex.tex` (`r4TerminalBoundary`), `app/src/CommandRegistry.lex.tex` / `studio/shell/command-registry-data.mjs` (`inprism-terminal` owning `terminal:open`, `terminal:write`, `terminal:resize`, `terminal:serialize`, `terminal:close`, `terminal:kill`), and `studio/shell/host-boundary.mjs` (`r4TerminalMissing`, `r4TerminalInvalid`, `r4TerminalExited`) move native terminal IPC cleanly under `invokeBoundCommand`.
- Worker & streaming turn integration (`studio/shell/host.js`): `ensureR4Studio` removes placeholder offline weights, configures the Worker via `set_host_config` with Foundry's `compiler/esm/browser.min.js` + `compiler/esbuild.wasm`, routes consent-gated Qwen3-0.6B (`ConsentRequiredForWeightDownload` -> `authorizeR4WeightsDownload`), explicit `uor-r4.native-q31-d85`, 4-token `chat_chunk` streaming, telemetry forwarding, `cancel_inprism_turn`, `audit_event` IndexedDB persistence, bidirectional filtered `/workspace` sync (`mvm_sync_workspace_in` / `mvm_export_workspace_diff`), and verified in-Prism `<prism-write>` admission (`const tags = inprism ? wrote : { ...wrote, writes: [], deletes: [], renames: [], deps: [] };`) preserving `!inprism` compiled protection and `REQ-005` decline refusals.
- Native `TerminalPanel` & controls: `createR4Runtime` implements `lexlean-sh` sessions emitting monotonic `terminal:data:${sessionId}` offsets and `terminal:exit:${sessionId}` alongside `window.__host.r4Studio` telemetry, network-mode (`authorizeSpiralCoreInternet` on `full_spiralcore`), relay URL, model tier, and `gitAction` APIs.

Planted defects, each refused, then restored:

- Bypassing `!inprism` code refusal (`const tags = wrote;` instead of `const tags = inprism ? wrote : { ...wrote, writes: [], deletes: [], renames: [], deps: [] };` in `studio/shell/host.js`): `node --test studio/tools/prism_r4_route.test.mjs studio/tools/live_main_integration.test.mjs studio/tools/generation_patch.test.mjs` fails 3 tests (`AssertionError`, `DEFECT1_EXIT=1`).
- Bypassing `REQ-005` refusal text on consent decline in `createR4Runtime.ask` (`throw errOf("r4Refused", "fake refusal bypass")`): `node --test studio/tools/prism_r4_route.test.mjs` fails test 10 (`Error: fake refusal bypass`, `DEFECT2_EXIT=1`).

# FA-97 — Unified Foundry studio: overlay removal, `Observatory` tab, Network Mode pill & GitHub publishing

- Overlay removal & native `ModelPicker` routing (`studio/shell/host.js`, `studio/shell/appearance.css`, `studio/vendor/prism/hologram.ModelPicker.tsx`, `studio/vendor/prism/hologram.screens/FeaturedAppShowcase.tsx`): Deleted `#foundry-lexlean-workspace`, `#foundry-lexlean-bar`, `#foundry-lexlean-frame`, `#foundry-lexlean-launch`, and `mountR4StudioWorkspace`; `?r4=studio` and Featured Card #1 dispatch `foundry:r4-studio` to select `r4:lexlean-r4` natively inside Foundry Home/Chat without spawning an overlay iframe.
- `Observatory` tab & `uor-observatory/1` bridge (`studio/vendor/prism/hologram.screens.mjs` patching `src/atoms/appAtoms.ts`, `src/window_infrastructure/types.ts`, `src/components/preview_panel/PreviewToolbar.tsx`, `src/components/preview_panel/PreviewPanel.tsx`; `studio/shell/host.js` `ensureR4Studio`): Added `"observatory"` mode using `@/components/ui/button` (`min-h-11` `>= 44px` touch target), mounting `<iframe src=".../holo/<archiveKappa>/?surface=observatory" sandbox="allow-scripts">` after caching a self-contained Observatory document in `caches.open("holo")`, verifying `ev.source === frameRef.current?.contentWindow && ev.data?.protocol === "uor-observatory/1" && ev.data?.op === "ready"`, posting computed `--background`, `--card`, `--foreground`, `--border`, `--font-sans`, `--font-mono` `theme` vars, and streaming live `telemetry` snapshots from `window.__host.r4Studio`.
- `TerminalPanel` Network Mode pill, Settings Relay URL & GitHub publishing (`studio/vendor/prism/hologram.screens.mjs`, `studio/vendor/prism/hologram.GitHubIntegration.tsx`, `studio/vendor/prism/hologram.typecheck.mjs`): Added `NetworkModePill` (`data-testid="prism-network-mode-pill"`, `Sandboxed` ↔ `Full SpiralCore Internet`), `SpiralCoreRelaySetting` (`"SpiralCore Relay URL"`, `DEFAULT_SPIRALCORE_RELAY_WS_URL`) in Settings & `settingsSearchIndex.ts`, and `GitHubIntegration` / `GitHubConnector` / `UnconnectedGitHubConnector` (`"GitHub personal token"` stored via MVM `set_secret`, `gitAction` `clone`/`branch`/`commit`/`push`/`pr` -> `create_pr`, zero `"API key"` copy, zero raw hex colors, zero removed Electron channels).

Planted defect, refused, then restored:

- Substituting `"GitHub API key"` for `"GitHub personal token"` in `studio/vendor/prism/hologram.GitHubIntegration.tsx`: `node --test studio/tools/shell_ui.test.mjs` immediately fails test 10 (`AssertionError [ERR_ASSERTION]: ../vendor/prism/hologram.GitHubIntegration.tsx introduces API key copy`, `DEFECT_CAUGHT=1`); restored, all `30` tests across `prism_r4_route.test.mjs` + `shell_ui.test.mjs` pass.
- Fix Round 1 (`host.js` `gitAction`/`ensureR4Studio`, `sw.template.js` `decodeURIComponent(id)`, `hologram.GitHubIntegration.tsx`, `hologram.screens.mjs` `ObservatoryView`, `FeaturedAppShowcase.tsx`, `hologram.ModelPicker.tsx`, `no_remote_provider_browser.mjs`, `VENDORED.md`): passed filtered `/workspace` `files` on `"commit"`/`"push"`/`"commit_push"`, removed reload-stale `r4:github-connected` persistence in favor of active Worker `#secretVault` tracking (`hasGithubToken`), validated `api.github.com/user` without swallowing errors, surfaced Worker `res.message` and `html_url`/`pr_url`/`url`, awaited async `r4.pin()` + reset `readyRef` in `ObservatoryView` (without hardcoded fallback hash), escaped `</script` in inline Observatory HTML, awaited `updateSettings` + `queryClient.invalidateQueries` before `navigate({ to: "/" })` in `TheaterPage`, and updated `no_remote_provider_browser.mjs` + `VENDORED.md`.
- Omitting `"commit"` from `["push", "commit_push", "commit"]` in `studio/shell/host.js` `gitAction`: `node --test studio/tools/prism_r4_route.test.mjs` immediately fails test 20 (`AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal: undefined !== [{ path: 'src/App.tsx', ... }]`, `DEFECT_R1_CAUGHT=1`); restored, all `31` tests across `prism_r4_route.test.mjs` + `shell_ui.test.mjs` pass.
