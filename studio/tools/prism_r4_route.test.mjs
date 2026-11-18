// FA-87: a chat turn is answered only by Foundry's own reader or the pinned in-Prism LexLean-R4
// Studio. Prism R4 (afflom/me's spec, r4/spec.json) decides each turn: a route to any other model
// is ungranted and refused before the request is made, and every answer is judged before shown.
import assert from "node:assert/strict"; import crypto from "node:crypto"; import fs from "node:fs"; import test from "node:test"; import vm from "node:vm";

const shell = new URL("../shell/", import.meta.url), specBytes = fs.readFileSync(new URL("r4/spec.json", shell)), pinBytes = fs.readFileSync(new URL("r4/lexlean-r4.json", shell)), spec = JSON.parse(specBytes), pin = JSON.parse(pinBytes);
globalThis.fetch = async (url) => { const s = String(url); if (s === new URL("r4/spec.json", shell).href) return { ok: true, json: async () => JSON.parse(specBytes) }; if (s === new URL("r4/lexlean-r4.json", shell).href) return { ok: true, json: async () => JSON.parse(pinBytes) }; assert.fail("R4 reads only its own spec and pin, from this origin: " + s); };
const { r4Decide, r4InprismFacts, r4Refusal, r4Request, r4StudioPin, GRANT } = await import("../shell/r4.mjs");
const { chatModelRoute, INPRISM_MODEL } = await import("../shell/chat-model-route.mjs"); const { judge } = await import("../shell/prism/spec.mjs");
const host = fs.readFileSync(new URL("host.js", shell), "utf8"), chatTurn = host.slice(host.indexOf("async function chatTurn("), host.indexOf("    // T6: completed batches"));

test("the R4 spec is afflom/me's, byte for byte, and judges each of its examples as stated", () => {
  assert.equal(crypto.createHash("sha256").update(specBytes).digest("hex"), "808b936a8f33c67c0563fbd3069753e221c644ca20fcc1a81a1c37b19644b254"); assert.equal(spec.examples.length, 18);
  for (const { request, response } of spec.examples) { const values = request.split(" "); assert.equal(judge(spec, Object.fromEntries(spec.fields.map((f, i) => [f.name, values[i]]))).outcome, response, request); }
});

test("Foundry grants no route, so every model outside it is refused before the request", async () => {
  assert.deepEqual(GRANT, []);
  for (const provider of ["featherless", "openrouter", "anything"]) {
    const request = r4Request({ provider }); assert.equal(request.mode, "routed"); assert.equal(request.route, "ungranted");
    const decision = await r4Decide(request); assert.equal(decision.outcome, "refuse"); assert.match(r4Refusal(decision, request), /own language and reasoning/);
  }
});

test("Foundry's reader answers as a compiled model: no weights, no route", async () => {
  const request = r4Request({ provider: "local" }); assert.deepEqual(request, { mode: "compiled", engine: "match", weights: "none", route: "none", boundary: "allow" }); assert.equal((await r4Decide(request)).outcome, "answer");
  for (const weights of ["match", "missing"]) assert.equal((await r4Decide({ ...request, weights })).rule, "REQ-003", "a compiled model carries no blob");
  const engine = await r4Decide({ ...request, engine: "missing" }); assert.equal(engine.rule, "REQ-001"); assert.match(r4Refusal(engine, request), /pin/);
});

test("a chat turn is read by the kernel guest's IdeaReader and judged by R4 before it is shown", () => {
  const read = chatTurn.indexOf('.ask("read "'), made = chatTurn.indexOf("await r4Decide(made)");
  assert.ok(chatTurn.indexOf("await r4Decide(before)") > 0 && read > chatTurn.indexOf("await r4Decide(before)"), "R4 decides the route before the idea is read");
  assert.ok(made > read && made < chatTurn.indexOf("await enqueueText((notationLines"), "R4 judges the reading before it is shown");
  for (const remote of ["paidGenerate", "sealPaid", "openrouter/", 'op: "warmup"', "inst.generate(", "rulesModel("]) assert.ok(!chatTurn.includes(remote), `a chat turn never reaches ${remote}`);
});

test("the studio offers Foundry's reader by default alongside pinned in-Prism LexLean-R4, with zero cloud providers", () => {
  assert.ok(host.includes('selectedModel: { name: LOCAL_MODEL, provider: "local" }') && host.includes("apiName: INPRISM_MODEL") && host.includes('handlers.set("get-language-model-providers", () => [LOCAL]);') && host.includes('handlers.set("get-language-models-by-providers", () => ({ local: LOCAL_MODELS }));'));
});

test("LexLean-R4 Studio answers in Prism only when its .holo archive and dual weights pins match", async () => {
  const loadedPin = await r4StudioPin(), installed = { kappa: pin.archiveKappa, fingerprint: pin.fingerprint };
  assert.ok(loadedPin.archiveKappa === pin.archiveKappa && loadedPin.wasmSha256 === pin.wasmSha256);
  assert.deepEqual(chatModelRoute({ provider: "local", name: INPRISM_MODEL }, { provider: "local", name: "foundry:reader" }), { provider: "local", model: INPRISM_MODEL, paid: false });
  for (const [args, label] of [[[pin.qwen3WeightsKappa], "qwen3"], [[pin.offlineQ31WeightsKappa, "offlineQ31"], "offlineQ31"]]) {
    const ok = r4Request({ provider: "local", model: INPRISM_MODEL, ...r4InprismFacts(pin, installed, ...args) });
    assert.deepEqual(ok, { mode: "inprism", engine: "match", weights: "match", route: "none", boundary: "allow" }, label); assert.equal((await r4Decide(ok)).outcome, "answer", label);
  }
  for (const [label, facts, rule] of [["unpinned", r4InprismFacts(pin, installed, "sha256:" + "0".repeat(64)), "REQ-002"], ["unrequested-offline", r4InprismFacts(pin, installed, pin.offlineQ31WeightsKappa), "REQ-002"], ["mismatch", r4InprismFacts(pin, installed, "mismatch"), "REQ-002"], ["missing", r4InprismFacts(pin, installed, null), "REQ-005"], ["engine", r4InprismFacts(pin, { kappa: "blake3:bad", fingerprint: "00" }, pin.qwen3WeightsKappa), "REQ-001"]]) {
    const req = r4Request({ provider: "local", model: INPRISM_MODEL, ...facts }), dec = await r4Decide(req); assert.ok(dec.outcome === "refuse" && dec.rule === rule && r4Refusal(dec, req).length > 10, label);
  }
  const fnSrc = host.slice(host.indexOf("async function r4StudioFacts("), host.indexOf("async function askR4Studio("));
  for (const wKappa of ["", undefined]) {
    const f = await vm.runInNewContext(`(${fnSrc})`, { r4StudioPin: async () => pin, installed: async () => [installed], get: async () => ({ wasmSha256: pin.wasmSha256, family: "offlineQ31", weightsKappa: wKappa }), r4InprismFacts })(null);
    assert.equal(f.weights, "missing"); assert.equal((await r4Decide(r4Request({ provider: "local", model: INPRISM_MODEL, ...f }))).rule, "REQ-005");
  }
});

test("bundled LexLean-R4 .holo is content-addressed, locally verified <= 32 MiB, and lazy-cached", async () => {
  assert.equal(pin.holoFile, `${pin.fingerprint}.holo`); assert.equal(pinBytes.includes("app.holo"), false); assert.match(pin.qwen3WeightsKappa || "", /^sha256:[0-9a-f]{64}$/); assert.match(pin.offlineQ31WeightsKappa || "", /^sha256:[0-9a-f]{64}$/);
  assert.equal(pin.holoFingerprintUrl, `https://casey-allard.github.io/lexlean-r4/holo/${pin.fingerprint}.holo`);
  const bytes = new Uint8Array(fs.readFileSync(new URL(`r4/${pin.holoFile}`, shell))), holoPath = `r4/${pin.holoFile}`, holoRow = { path: holoPath, bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
  assert.ok(bytes.length === pin.holoByteLength && bytes.length <= 32 * 1024 * 1024 && Buffer.from(bytes.subarray(bytes.length - 32)).toString("hex") === pin.fingerprint);
  const { default: init, kappa } = await import("../shell/q/pkg/holospaces_web.js"); await init({ module_or_path: fs.readFileSync(new URL("q/pkg/holospaces_web_bg.wasm", shell)) }); assert.equal(kappa(bytes), pin.archiveKappa);
  const { sections, extensions, blobs, decodeView } = await import("../shell/holo.js"), secs = sections(bytes), exts = extensions(secs), blbs = new Map(blobs(secs).map((b) => [b.kappa, b.bytes]));
  const dir = JSON.parse(Buffer.from(exts.find((e) => e.key.includes("directory")).bytes).toString("utf8")), prov = JSON.parse(Buffer.from(exts.find((e) => e.key.includes("prismpm-model")).bytes).toString("utf8")), wf = decodeView(blbs.get(pin.viewContentKappa)).files.find((f) => f.path === "lexlean_r4_bg.wasm");
  assert.ok(prov.application_kappa === pin.applicationKappa && prov.model_content_kappa === pin.modelContentKappa && dir.layers.find((l) => l.kind === "wasm")?.content_kappa === pin.guestContentKappa && dir.layers.find((l) => l.kind === "view")?.content_kappa === pin.viewContentKappa && wf && crypto.createHash("sha256").update(wf.bytes).digest("hex") === pin.wasmSha256 && host.includes('new URL("./r4/" + pin.holoFile'));
  await import("../shell/shell-cache.js");
  const all = { "index.html": "h", "host.js": "j", "core.wasm": "w", "assets/index.js": "a", "assets/index.css": "c", "scaffold/files.json": "[]", "editor/vs/loader.js": "e", "editor/package.json": "{}", "compiler/package.json": "{}", "compiler/esm/browser.min.js": "b", "compiler/esbuild.wasm": "m", [holoPath]: "HOLO" };
  const rows = Object.entries(all).sort(([a], [b]) => (a < b ? -1 : 1)).map(([p, b]) => ({ bytes: Buffer.byteLength(b), path: p, sha256: crypto.createHash("sha256").update(b).digest("hex") })), closure = crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex"), seen = [];
  const entries = await globalThis.ShellClosure.prepare("https://example.test/foundry/", closure, { lazy: (p) => /^r4\/.*\.holo$/.test(p), fetchFn: async (u) => { const p = u.pathname.slice(9); seen.push(p); return new Response(p === "manifest.json" ? JSON.stringify({ spec: "hologram-forge/shell/1", closure, files: rows }) : p === "provenance.json" ? JSON.stringify({ browser_projection_sha256: closure }) : all[p]); } });
  assert.ok(!seen.includes(holoPath) && entries.length === rows.length + 1 && fs.readFileSync(new URL("sw.template.js", shell), "utf8").includes('"fill"'));
  await globalThis.ShellClosure.verifyFile("https://example.test/foundry/", holoRow, { fetchFn: async () => new Response(bytes) });
  const bad = new Uint8Array(bytes); bad[0] ^= 1; await assert.rejects(globalThis.ShellClosure.verifyFile("https://example.test/foundry/", holoRow, { fetchFn: async () => new Response(bad) }), { code: "shellFileMismatch" });
  const swSrc = fs.readFileSync(new URL(fs.existsSync(new URL("sw.js", shell)) ? "sw.js" : "sw.template.js", shell), "utf8"), swCode = swSrc.includes("__CLOSURE__") ? swSrc.replaceAll("__CLOSURE__", closure) : swSrc;
  const stores = new Map(), openCache = n => { if (!stores.has(n)) stores.set(n, new Map()); const m = stores.get(n); return { match: async (r, o) => { const u = new URL(typeof r === "string" ? r : r.url, "https://example.test/foundry/"); if (o?.ignoreSearch) u.search = ""; const v = m.get(u.href); return v ? new Response(v.slice()) : undefined; }, put: async (r, res) => { m.set(new URL(typeof r === "string" ? r : r.url, "https://example.test/foundry/").href, new Uint8Array(await res.arrayBuffer())); } }; };
  const ev = {}, savedFetch = globalThis.fetch; let fetches = 0, swMode = "ok";
  try {
    globalThis.fetch = async u => { fetches++; if (swMode === "offline") throw new Error("offline"); const s = String(u?.url || u); return s.endsWith(pin.holoFile) ? new Response(swMode === "bad" ? bad : bytes) : new Response("nope", { status: 404 }); };
    const ctx = { URL, Request, Response, Headers, TextEncoder, TextDecoder, crypto, console, fetch: (...a) => globalThis.fetch(...a), importScripts: () => {}, ForgeKernel: { load: async () => ({}) }, ShellClosure: globalThis.ShellClosure, caches: { open: async n => openCache(n) }, location: { origin: "https://example.test" }, self: { registration: { scope: "https://example.test/foundry/" }, location: { origin: "https://example.test" }, addEventListener: (t, fn) => { ev[t] = fn; }, skipWaiting: async () => {} } };
    vm.runInNewContext(swCode, ctx); const swC = vm.runInNewContext("CLOSURE", ctx), sc = openCache("shell-" + swC);
    await sc.put("https://example.test/foundry/manifest.json", new Response(JSON.stringify({ spec: "hologram-forge/shell/1", files: [holoRow] })));
    const askFetch = u => { let p; ev.fetch({ request: { url: u, method: "GET", mode: "cors" }, respondWith: r => { p = Promise.resolve(r); } }); return p; };
    let wFill; ev.message({ data: "fill", waitUntil: p => { wFill = p; } });
    const [, rHit] = await Promise.all([wFill, askFetch("https://example.test/foundry/" + holoPath)]);
    assert.ok(rHit.status === 200 && fetches === 1 && await sc.match("https://example.test/foundry/" + holoPath));
    fetches = 0; const evil = await askFetch("https://example.test/foundry/r4/evil.holo"); assert.ok(evil.status === 404 && fetches === 0);
    stores.get("shell-" + swC).delete("https://example.test/foundry/" + holoPath); swMode = "bad";
    assert.equal((await askFetch("https://example.test/foundry/" + holoPath)).status, 503); assert.equal(await sc.match("https://example.test/foundry/" + holoPath), undefined);
    swMode = "offline"; assert.equal((await askFetch("https://example.test/foundry/" + holoPath)).status, 503);
  } finally { globalThis.fetch = savedFetch; }
});

test("R4 weights download and SpiralCore internet disclosures queue via native dialog and persist to refs + audit", async () => {
  const { authorizeR4WeightsDownload, authorizeSpiralCoreInternet, commitR4Consent } = await import("../shell/preview-permissions.mjs");
  const mockDom = () => {
    const nodes = []; class El extends EventTarget { constructor(t) { super(); this.tag = t; this.style = {}; this.children = []; this.attrs = {}; nodes.push(this); } append(...c) { this.children.push(...c); } setAttribute(k, v) { this.attrs[k] = v; } remove() { this.removed = true; } showModal() {} show() {} focus() { doc.activeElement = this; } click() { this.dispatchEvent(new Event("click")); } }
    const doc = { createElement: (t) => new El(t), body: new El("body"), activeElement: { focus() {} } }, dlgs = () => nodes.filter((n) => !n.removed && n.tag === "dialog"), dlg = () => dlgs()[0];
    return { document: doc, dlgs, dlg, btn: (t) => dlg()?.children.find((n) => n.tag === "button" && n.textContent === t), btns: () => dlg()?.children.filter((n) => n.tag === "button").map((n) => n.textContent) };
  };
  const mockDb = () => { const stores = { refs: new Map(), audit: new Map() }; return { stores, transaction: () => { const tx = { objectStore: (n) => ({ put: (v, k) => stores[n].set(k, v) }) }; queueMicrotask(() => tx.oncomplete?.()); return tx; } }; };
  const db1 = mockDb(), ui1 = mockDom(), wInput = { source: "blake3:" + "1".repeat(64), endpoints: ["https://huggingface.co"] }, sInput = { source: "blake3:" + "2".repeat(64), endpoints: ["https://registry.npmjs.org"] };
  const p1 = authorizeR4WeightsDownload(wInput, { document: ui1.document, online: () => true, db: db1 });
  assert.equal(ui1.dlg().attrs["aria-label"], "Review R4 model weights download"); assert.deepEqual(ui1.btns(), ["Don't allow", "Allow download"]); assert.equal(ui1.document.activeElement, ui1.btn("Don't allow")); ui1.btn("Don't allow").click();
  await assert.rejects(p1, { code: "previewPermissionDenied" }); assert.equal(db1.stores.refs.get("capabilities:r4:weights-download")?.outcome, "denied"); assert.equal([...db1.stores.audit.values()][0]?.outcome, "denied");
  const pEsc = authorizeR4WeightsDownload(wInput, { document: ui1.document, online: () => true, db: db1 });
  ui1.dlg().dispatchEvent(Object.assign(new Event("keydown"), { key: "Escape" })); await assert.rejects(pEsc, { code: "previewPermissionDenied" });
  const db2 = mockDb(), ui2 = mockDom(), p2a = authorizeR4WeightsDownload({ ...wInput, source: sInput.source }, { document: ui2.document, online: () => true, db: db2 }), p2b = authorizeSpiralCoreInternet(sInput, { document: ui2.document, online: () => true, db: db2 });
  assert.ok(ui2.dlgs().length === 1 && ui2.dlg().attrs["aria-label"] === "Review R4 model weights download"); ui2.dlg().dispatchEvent(new Event("cancel")); await assert.rejects(p2a, { code: "previewPermissionDenied" });
  assert.ok(ui2.dlgs().length === 1 && ui2.dlg().attrs["aria-label"] === "Review SpiralCore internet access"); assert.deepEqual(ui2.btns(), ["Don't allow", "Allow Full SpiralCore Internet"]);
  assert.equal(ui2.document.activeElement, ui2.btn("Don't allow")); ui2.btn("Allow Full SpiralCore Internet").click();
  assert.equal((await p2b).disclosure.id, "r4:spiralcore-internet"); assert.equal(db2.stores.refs.get("capabilities:r4:spiralcore-internet")?.outcome, "granted");
  await assert.rejects(authorizeR4WeightsDownload(wInput, { document: ui2.document, online: () => false, db: db2 }), { code: "previewPermissionOffline" });
  let isOnline = true; const pOff = authorizeSpiralCoreInternet(sInput, { document: ui2.document, online: () => isOnline, db: db2 }); isOnline = false; ui2.btn("Allow Full SpiralCore Internet").click();
  await assert.rejects(pOff, { code: "previewPermissionOffline" }); assert.equal(db2.stores.refs.get("capabilities:r4:spiralcore-internet")?.outcome, "granted"); assert.equal([...db2.stores.audit.values()].filter((a) => a.outcome === "offline").length, 2);
  await assert.rejects(commitR4Consent(db2, "r4:weights-download", { disclosure: { id: "r4:weights-download", ...wInput }, expires: Date.now() - 1 }, "granted"), { code: "previewPermissionExpired" });
  const savedNow = Date.now; Date.now = () => 1700000000000;
  try { db1.stores.audit.clear(); await commitR4Consent(db1, "r4:weights-download", { disclosure: { id: "r4:weights-download", ...wInput }, expires: 1700000060000 }, "granted"); await commitR4Consent(db1, "r4:weights-download", { disclosure: { id: "r4:weights-download", ...wInput }, expires: 1700000060000 }, "denied"); assert.equal(db1.stores.audit.size, 2); } finally { Date.now = savedNow; }
});
