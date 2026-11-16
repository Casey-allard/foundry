# Private workspace

Authority: `FA-91` in `model/ids.toml`, scenario in `features/suites/private-workspace.feature`.

A visitor's work in Foundry is meant to be theirs alone: sealed on their devices under their Prism ID's
boundary key, and opened only for that ID. `app/src/Workspace.lex.tex` holds the decisions and
`app/src/WorkspaceProofs.lex.tex` their theorems, and Foundry's Prism
kernel answers them: `ForgeKernel::dispatch` sends a request that starts with `workspace ` to
`Workspace::dispatchWorkspace` (through `dispatchApplication`, ahead of the protocols, so the in-tab verdict's
entry stays as `studio/tools/in_tab_verdict_author.mjs` writes it).

The kernel answers five kinds of request: open a workspace, read a record, store a record, move the workspace
kept before an ID, and remove its plain copy. Each answer is `ok` or the first refusal, by name:
`workspaceDeviceRemoved`, `workspaceSessionExpired`, `workspaceNotOwner`, `workspaceKeyStale`, `workspaceClosed`,
`recordTampered`, `recordMisplaced`, `recordUnsealed`, `workspaceQuotaExceeded`, `workspaceAlreadyMoved`,
`sealedCopyNotCommitted`. Any other shape is `malformedWorkspaceRequest`; more than 128 bytes is
`workspaceRequestTooLarge`. `workspaceWireBoundary` states the wire.

Two kinds of evidence:

- Eight theorems, each that no request meets a `breaks` condition: a workspace opens only for its owner, only
  with the current key, only with a live session, never on a removed device; a record is read only when
  authentic and in place, stored only sealed and within quota; the move happens at most once; the plain copy goes
  only after the sealed copy is committed.
- Nineteen `workspaceWords_` theorems Lean proves by evaluation, each also an acceptance vector the compiled guest
  replays (`workspaceAcceptance`, ahead of `ruleAcceptance`). They cover every answer, plus a wrong version, a
  trailing word and an unknown kind.

`private_workspace_fa_91` in `crates/conformance/tests/in_tab_kernel_verdict.rs` holds the two together and to
dispatch: the dispatch arm is present, and the number of `workspaceWords_` theorems equals the number of workspace
vectors in the kernel (at least 19). `studio/tools/application_main_integration.test.mjs` counts every acceptance
vector in the kernel, now 355.

`npx prism-code verify --lean --local` in `app/` verified all 42 modules (attestation
`dcc25ea17350c5d1d40968b11c45d07bcff7199e36e6f8ca9a1d675b595e25b0`).

Mutation, 2026-11-16:

1. The decision. Removing the owner check from `openCode` made `npx prism-code verify --lean --local` fail: Lean
   rejected `workspaceWords_anotherIdRefused` (`src/Workspace.lex.tex:216` then; the theorem is now in `src/WorkspaceProofs.lex.tex`), which expects `workspaceNotOwner`.
   Restored, byte-identical to the verified module.
2. The vectors. Dropping one workspace vector from `workspaceAcceptance` in `app/src/ForgeKernel.lex.tex` made
   `cargo test -p repo-conformance --test in_tab_kernel_verdict` fail: `private_workspace_fa_91` panicked with
   `left: 19, right: 18`. Restored, 3 passed.

## Studio keeps the work sealed (FA-93)

Authority: `FA-93` in `model/ids.toml`, scenario in `features/suites/private-workspace.feature`.

Why: a visitor's apps, chats, files, versions, prompts and settings sat in this browser's IndexedDB in the clear,
readable by anything with the browser profile and kept on a device the visitor had removed from their Prism ID.

How. The Prism frame keeps a workspace key for this origin: 32 random bytes sealed under the Prism ID's private
boundary key (UOR-Foundation/template FR-04, `frame.workspaceKey()`), which only a device of the ID opens, and
which follows the ID when this browser joins it from another device or recovers it. Studio bundles the frame
`frame.lock` pins (`vite.shell.config.mts`, `assets/prism-frame.js`), so it works offline and asks no network.
`studio/shell/inference.js` (`workspace`) wraps the one database handle the host hands every writer: a value is
sealed with Hologram's `seal_bytes` (ChaCha20-Poly1305, a fresh nonce each time) as it is put, and opened with
`open_bytes` as it is read, inside the writer's own transaction, because the cipher is synchronous. The sealed
bytes carry the record's place (store and key), so a record copied elsewhere does not open there. No writer
changed. Left plain: the grants and published `.holo` bytes the service worker reads (a `.holo` is public and
checked by its address on read) and the audit it writes.

Every decision is the kernel's, asked of the guest Studio pins (`studio/KERNEL_REV`, the build of this model,
the same pin as #233): open, from the frame's answer (`openFacts`); the one move of the work kept before; and
read and store, whose answers for every case it gives once as the workspace opens. On `ok` the move seals every
record in place in one transaction, so its plain copy is gone exactly when the sealed copy commits, which is the
order `sealedCopyNotCommitted` guards. On `workspaceDeviceRemoved`, everything kept where work belongs is
cleared, a new key is made, and nothing left behind enters the new workspace.

What the visitor sees: nothing, until something changed. Then one sentence, each a statement of
`studio/experience/src/FoundryExperience.lex.tex` (`workspaceWords`), said by the sidebar
(`hologram.screens/AppSidebar.tsx`) as a toast; a workspace that cannot open offers Try again. The Prism ID
panel's card reads "Your ID and your work, sealed on your devices".

Evidence:

- `private_workspace_fa_93` (`crates/conformance/tests/in_tab_kernel_verdict.rs`) runs
  `studio/tools/in_tab_kernel_verdict.test.mjs`, whose FA-93 test builds every request with Studio's own
  `workspaceRequest` and `openFacts`, asks the guest Studio pins, and holds each answer to what Studio does with it.
- `studio/tools/storage_request_browser.mjs`, in Chromium in Studio CI, serves the built shell and runs its own
  `inference.js` over the real kernel guest, cipher and frame: work kept before is sealed in place and opens as
  written (a prompt's dates included); a record stored afterwards is sealed; an altered and a planted record are
  refused as `recordTampered` and a copied one as `recordMisplaced`, and none is returned, by `get` or `getAll`;
  the worker's grant stays plain; on a removed device the work and its built previews are cleared and a fresh
  workspace opens.
- `studio/tools/shell_ui.test.mjs` holds the six sentences the sidebar says to the experience module.

Planted defects, 2026-11-16:

| Gate | Planted defect | Result |
| --- | --- | --- |
| `storage_request_browser.mjs` | `seal` stores the value as it is (`return value;`) | rejected: `TypeError: Cannot read properties of undefined (reading 'records')`, the moved record no longer opened; restored, passes |
| `storage_request_browser.mjs` | the place is not checked (`bound` always 1) | rejected: `Error: 7:copied.md was returned`; restored, passes |
| `in_tab_kernel_verdict.test.mjs` (FA-93) | `openFacts` never reports a removed device | rejected: `not ok 8`, the guest answered `ok` where `workspaceDeviceRemoved` was required; restored, 8 of 8 pass |

What this does not establish. The work is sealed on this device; it is not carried to the visitor's other
devices, so a lost browser still loses what it alone kept (the Prism ID's own recovery restores the ID, not the
work). Keys are not sealed: an app's id and its files' paths stay readable as IndexedDB keys, because the
writers find an app's files by key range. Built previews and covers (the `previews` and `covers` caches) stay
plain while the device belongs to the ID, since the service worker serves them without it; a removed device
drops them with its work.

Why the theorems sit in their own module. `ForgeKernel` imports `Workspace`, so a `linear_arithmetic` proof
there stages `LexLeanRuntime.Laws` into the application build, where Lean's C emitter loops (LexLean #465;
`v2/build-speed/REPORT.md`). With the theorems in `Workspace`, the SDK's Lean stage timed out on CI twice
(`PP5007`, run 43915183780). `WorkspaceProofs` is an entrypoint nothing in the application imports, as
`ForgeKernelProofs` is.

Where it was run. `prismpm --project app verify` in the SDK image `prismpm.lock` pins did not finish on this
machine: its Lean stage allows 600 seconds, and compiling the SDK's runtime from cold took longer before reaching
any project module (`PP5007: application-lean timed out`). The proofs above used `prism-code` 0.8.0 with the
local Lean toolchain; CI runs the gate in the SDK image.
