Feature: prism-r4-route

  @FA-87 @build
  Scenario: A chat turn is answered only by Foundry's own model in Prism, and Prism R4 refuses every route to another model before the request leaves the tab
    Given the Prism R4 decision, afflom/me's spec byte for byte, and a studio whose grant names no route
    When a builder sends an idea from the home box or the chat with any model selection
    Then a route to a model outside Foundry is refused by R4 before the request is looked up or made
    And the device model's answer is shown, sealed and applied only when R4 answers answer for its weights and engine
    And weights not read back by their verified image address, or an engine without its address, are refused
    And the studio offers and defaults to the device model only, and a stored cloud selection is moved to it once

  @FA-95 @build
  Scenario: LexLean-R4 bundles a content-addressed archive verified locally under dual weights pins, lazy shell caching, and queued consent dialogs persisted to refs and audit
    Given the content-addressed LexLean-R4 archive, its pin manifest with dual weights kappas, and the shell closure policy
    When the studio verifies weights against Qwen3 or explicit offline Q31 pins, precaches the shell, or requests off-origin weights or SpiralCore internet access
    Then the bundled archive verifies locally under studio/core without remote fetch and is cached lazily without affecting initial Home LCP
    And unpinned or unrequested weights kappas are refused by R4 REQ-002 or REQ-005 while matching Qwen3 or explicit offlineQ31 kappas answer
    And consent dialogs focus refusal first, show why then how then what, and record decisions in IndexedDB refs and audit

  @FA-96 @build
  Scenario: In-Prism chat authoring streams verified LexLean-R4 tokens, applies consent-gated model weights and workspace patches under R4 rules, and wires Foundry's native terminal to lexlean-sh over shared /workspace
    Given the verified LexLean-R4 worker configured with Foundry's esbuild assets and consent-gated Qwen3 or pinned offline Q31 weights
    When an in-Prism chat turn streams tokens and <prism-write> tags, cancels mid-stream, syncs /workspace diffs, or opens TerminalPanel over terminal:*
    Then off-origin Qwen3 shard hydration requires native consent and refuses under REQ-005 when declined while verified in-Prism answers apply canonical <prism-write> patches and !inprism retains empty writes
    And TerminalPanel routes terminal:open, terminal:write, terminal:resize, terminal:serialize, terminal:close, and terminal:kill to lexlean-sh with monotonic terminal:data offsets and bidirectional /workspace sync

  @FA-97 @build
  Scenario: Native Foundry unification removes the #foundry-lexlean-* overlay, renders sandboxed Observatory telemetry over uor-observatory/1, adds the Prism Network Mode pill, and wires SpiralCore Relay URL and GitHub personal token publishing
    Given the unified Foundry shell without #foundry-lexlean-* overlays, a sandboxed holo Observatory view, and R4 runtime git/network controls
    When the builder selects ?r4=studio or Featured Card #1, opens Observatory in PreviewPanel, toggles Prism Network Mode in TerminalPanel, or configures SpiralCore Relay URL and GitHub personal token
    Then ?r4=studio and Featured Card #1 select r4:lexlean-r4 natively without mounting any overlay
    And PreviewToolbar exposes an Observatory tab mounting holo/<id>/?surface=observatory with uor-observatory/1 ready/theme/telemetry handshake
    And TerminalPanel shows the Prism Network Mode pill and Settings/PublishPanel expose SpiralCore Relay URL and GitHub personal token gitAction controls with zero API key copy
