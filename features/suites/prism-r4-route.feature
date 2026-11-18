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
