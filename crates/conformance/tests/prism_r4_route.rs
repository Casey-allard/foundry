//! The `prism-r4-route` suite: one test per scenario in `features/suites/prism-r4-route.feature`.
use std::path::PathBuf;
use std::process::Command;

fn run_node_tap(rel: &str, n: &str) {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let target = manifest.ancestors().nth(2).unwrap().join(rel);
    let out = Command::new("node")
        .args(["--test", "--test-reporter=tap"])
        .arg(target)
        .output()
        .unwrap();
    let report = String::from_utf8_lossy(&out.stdout);
    let err = String::from_utf8_lossy(&out.stderr);
    assert!(out.status.success(), "{report}\n{err}");
    let reqs = format!("# tests {n}\n# pass {n}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0");
    for req in reqs.lines() {
        assert!(report.lines().any(|l| l == req), "incomplete: {report}");
    }
}

/// `FA-87`: A chat turn is answered only by Foundry's own model in Prism, and Prism R4 refuses every route to another model before the request leaves the tab
#[test]
fn prism_r4_route_fa_87() {
    run_node_tap("studio/tools/prism_r4_route.test.mjs", "21");
}

/// `FA-95`: LexLean-R4 bundles a content-addressed archive verified locally under dual weights pins, lazy shell caching, and queued consent dialogs persisted to refs and audit
#[test]
fn prism_r4_route_fa_95() {
    run_node_tap("studio/tools/prism_r4_route.test.mjs", "21");
    run_node_tap("studio/tools/shell_ui.test.mjs", "10");
}

/// `FA-96`: In-Prism chat authoring streams verified LexLean-R4 tokens, applies consent-gated model weights and workspace patches under R4 rules, and wires Foundry's native terminal to lexlean-sh over shared /workspace
#[test]
fn prism_r4_route_fa_96() {
    run_node_tap("studio/tools/prism_r4_route.test.mjs", "21");
    run_node_tap("studio/tools/generation_patch.test.mjs", "6");
    run_node_tap("studio/tools/command_ownership_registry.test.mjs", "6");
}

/// `FA-97`: Foundry removes the #foundry-lexlean-* overlay so ?r4=studio and Featured Card #1 natively select r4:lexlean-r4, adds the Observatory tab over uor-observatory/1, exposes the Prism Network Mode pill in TerminalPanel, and wires SpiralCore Relay URL and GitHub personal token publishing under audit-prism
#[test]
fn prism_r4_route_fa_97() {
    run_node_tap("studio/tools/prism_r4_route.test.mjs", "21");
    run_node_tap("studio/tools/shell_ui.test.mjs", "10");
}
