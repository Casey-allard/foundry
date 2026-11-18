import { oneAtATime } from "./approval-queue.mjs";
import { mountShellAction } from "./shell-action-dock.mjs";
// FoundrySpecification.previewPermissionBoundary: consent binds a source and exact origins.
const messages = { invalidPreviewPermission: "Invalid preview permission", previewPermissionDenied: "Preview permission declined", previewPermissionExpired: "Preview approval expired; allow the preview again", previewPermissionOffline: "Networked previews are unavailable while offline", previewPermissionUnavailable: "Preview permission controls are unavailable", previewPermissionChanged: "Preview permission changed; review the current request again", previewPermissionStorageFailed: "Preview permission could not be saved or revoked" };
export const previewPermissionFailure = code => Object.assign(new Error(messages[code] || messages.previewPermissionUnavailable), { code: Object.hasOwn(messages, code) ? code : "previewPermissionUnavailable" });
export function describePreview(input) {
  const fail = () => { throw previewPermissionFailure("invalidPreviewPermission"); };
  if (!input || typeof input.id !== "string" || !/^[A-Za-z0-9:_-]{1,256}$/.test(input.id) || typeof input.source !== "string" || !/^blake3:[0-9a-f]{64}$/.test(input.source) || !Array.isArray(input.endpoints) || input.endpoints.length > 32) fail();
  const endpoints = input.endpoints.map(origin => {
    if (typeof origin !== "string" || origin.length > 255 || !/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:[0-9]{1,5})?$/.test(origin)) fail();
    try { if (new URL(origin).origin !== origin) fail(); } catch { fail(); }
    return origin;
  });
  if (new Set(endpoints).size !== endpoints.length) fail();
  return Object.freeze({ id: input.id, source: input.source, endpoints: Object.freeze(endpoints) });
}
export function previewPermissionRecord(permission, at = Date.now()) {
  if (!Number.isFinite(at) || !Number.isFinite(permission?.expires) || permission.expires <= at || permission.expires > at + 300000) throw previewPermissionFailure("previewPermissionExpired");
  const d = describePreview(permission.disclosure), expires = permission.expires;
  return { serve: true, network: { endpoints: [...d.endpoints], denied: [] }, previewConsent: { profile: "foundry/preview-consent/1", id: d.id, source: d.source, grantedAt: at, ...(permission.purpose === "portable-build" ? { purpose: "portable-build", expires } : {}) } };
}
function runStoreTx(db, stores, fn) {
  return new Promise((resolve, reject) => {
    let transaction, refusal = "previewPermissionStorageFailed";
    try {
      transaction = db.transaction(stores, "readwrite"); transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(previewPermissionFailure(refusal));
      transaction.onerror = () => { try { transaction.abort(); } catch {} }; fn(transaction, code => { refusal = code; transaction.abort(); });
    } catch { try { transaction?.abort(); } catch {} reject(previewPermissionFailure("previewPermissionStorageFailed")); }
  });
}
export async function commitPreviewPermission(db, id, permission, expected) {
  const record = previewPermissionRecord(permission), expires = permission.expires;
  let previous; try { previous = structuredClone(expected); } catch { throw previewPermissionFailure("invalidPreviewPermission"); }
  if (record.previewConsent.id !== id) throw previewPermissionFailure("invalidPreviewPermission");
  return runStoreTx(db, "refs", (tx, abortWith) => {
    const store = tx.objectStore("refs"), req = store.get("capabilities:" + id);
    req.onsuccess = () => {
      try {
        if (JSON.stringify(req.result) !== JSON.stringify(previous)) return abortWith("previewPermissionChanged");
        // Revalidate time inside the transaction, after any competing revocation.
        if (Date.now() >= expires) return abortWith("previewPermissionExpired");
        store.put(record, "capabilities:" + id);
      } catch (e) { abortWith(Object.hasOwn(messages, e?.code) ? e.code : "previewPermissionStorageFailed"); }
    };
  });
}
let auditSeq = 0;
export async function commitR4Consent(db, id, permission, outcome = "granted") {
  const at = Date.now(), d = describePreview(permission?.disclosure);
  if (d.id !== id) throw previewPermissionFailure("invalidPreviewPermission");
  if (outcome === "granted" && (!Number.isFinite(permission?.expires) || permission.expires <= at)) throw previewPermissionFailure("previewPermissionExpired");
  const granted = outcome === "granted", record = { serve: false, network: { endpoints: granted ? [...d.endpoints] : [], denied: granted ? [] : [...d.endpoints] }, consentKind: id, outcome, r4Consent: { profile: "foundry/r4-consent/1", id: d.id, source: d.source, updatedAt: at, outcome } };
  await runStoreTx(db, ["refs", "audit"], tx => { if (outcome !== "offline") tx.objectStore("refs").put(record, "capabilities:" + id); tx.objectStore("audit").put({ timestamp_millis: at, principal: "r4:" + id, operation: "r4.consent." + id, resource: d.source, outcome }, `${at}:${++auditSeq}:r4:${id}`); });
  return record;
}
const element = (document, tag, text) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
const makeDialog = (document, label, heading) => {
  const dialog = element(document, "dialog"); dialog.style.cssText = "max-width:min(90vw,42rem);max-height:85vh;overflow:auto;padding:1.5rem;border-radius:0.75rem;color-scheme:light dark;font:inherit";
  dialog.setAttribute("aria-label", label); dialog.append(element(document, "h2", heading)); return dialog;
};
function askReviewDialog({ label, heading, beforeList, endpoints, afterList, allowLabel, modal = false, document = globalThis.document, online = () => globalThis.navigator.onLine, timeoutMs = 300000, onSettled }) {
  return new Promise((resolve, reject) => {
    let dialog, timer, settled = false; const previous = document?.activeElement, expires = Date.now() + timeoutMs;
    const finish = (error, extra) => {
      if (settled) return; settled = true; clearTimeout(timer); dialog?.remove(); previous?.focus?.();
      const done = () => error ? reject(previewPermissionFailure(error)) : resolve(extra);
      if (onSettled) Promise.resolve(onSettled(error || "granted", expires)).then(done, e => reject(Object.hasOwn(messages, e?.code) ? e : previewPermissionFailure("previewPermissionStorageFailed"))); else done();
    };
    try {
      dialog = makeDialog(document, label, heading); for (const text of beforeList) dialog.append(element(document, "p", text));
      const list = element(document, "ul"); for (const origin of endpoints) list.append(element(document, "li", origin)); dialog.append(list);
      for (const text of afterList) dialog.append(element(document, "p", text));
      const deny = element(document, "button", "Don't allow"), allow = element(document, "button", allowLabel); deny.type = allow.type = "button"; deny.autofocus = true;
      deny.addEventListener("click", () => finish("previewPermissionDenied")); dialog.addEventListener("cancel", event => { event.preventDefault(); finish("previewPermissionDenied"); });
      allow.addEventListener("click", () => { if (Date.now() >= expires) finish("previewPermissionExpired"); else if (!online()) finish("previewPermissionOffline"); else finish(null, expires); });
      dialog.append(deny, allow); document.body.append(dialog); timer = setTimeout(() => finish("previewPermissionExpired"), timeoutMs);
      if (modal) dialog.showModal(); else { dialog.style.position = "fixed"; dialog.style.inset = "auto 1rem 1rem auto"; dialog.style.margin = "0"; dialog.style.zIndex = "50"; dialog.show(); }
      deny.focus(); dialog.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); finish("previewPermissionDenied"); } });
    } catch { finish("previewPermissionUnavailable"); }
  });
}
// Asked in its turn: a dialog opened over another approval's would cover its buttons (approval-queue.mjs).
export function authorizePreview(input, options) { return oneAtATime(() => authorizePreviewNow(input, options)); }
function authorizePreviewNow(input, { document = globalThis.document, online = () => globalThis.navigator.onLine, timeoutMs = 300000 } = {}) {
  let disclosure; try { disclosure = describePreview(input); if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) throw previewPermissionFailure("invalidPreviewPermission"); if (!online()) throw previewPermissionFailure("previewPermissionOffline"); } catch (error) { return Promise.reject(messages[error?.code] ? error : previewPermissionFailure("previewPermissionUnavailable")); }
  return askReviewDialog({ label: "Review preview permissions", heading: "Let this preview reach the internet?", beforeList: ["The preview runs your app's code, and that code loads parts from the sites below.", "Those sites will see what the code sends them, your IP address and your browser's details, and may keep it. Your AI key is never included.", `This exact version of the app: ${disclosure.source}`], endpoints: disclosure.endpoints, afterList: ["You are approving this one version of the preview. You can withdraw it later under Preview permissions; that stops new requests, but cannot take back what was sent."], allowLabel: "Allow this preview", modal: false, document, online, timeoutMs }).then(expires => Object.freeze({ disclosure, expires }));
}
const ZERO_SOURCE = "blake3:" + "0".repeat(64);
const R4_DISCLOSURES = {
  weights: { id: "r4:weights-download", label: "Review R4 model weights download", heading: "Download LexLean-R4 model weights?", endpoints: ["https://huggingface.co"], allow: "Allow download", before: s => ["LexLean-R4 runs on this device and needs about ~410 MiB of model weights stored in browser OPFS shards before answering.", "Your browser fetches verified shards from the sites below, which see your IP address and browser details.", `Pinned archive identity: ${s}`], after: ["You are approving this download to local storage. You can remove stored weights or withdraw consent later, which stops future downloads but cannot take back what was sent."] },
  spiralcore: { id: "r4:spiralcore-internet", label: "Review SpiralCore internet access", heading: "Enable Full SpiralCore Internet?", endpoints: ["https://registry.npmjs.org"], allow: "Allow Full SpiralCore Internet", before: s => ["Full SpiralCore Internet lets the LexLean-R4 terminal and container reach websites beyond the default package registries.", "Direct requests and any fallback through the SpiralCore relay share your IP address and browser details with the sites you ask for. Your GitHub token stays strictly in browser-direct GitHub requests.", `Active mode identity: ${s}`], after: ["You are approving Full SpiralCore Internet until you switch back to Sandboxed mode. Switching back stops new requests, but cannot take back what was sent."] },
};
function authorizeR4DisclosureNow(kind, input = {}, { document = globalThis.document, online = () => globalThis.navigator.onLine, timeoutMs = 300000, db = null } = {}) {
  const cfg = R4_DISCLOSURES[kind], map = { granted: "granted", previewPermissionExpired: "expired", previewPermissionOffline: "offline" }; let disclosure;
  try { disclosure = describePreview({ id: cfg.id, source: input?.source || ZERO_SOURCE, endpoints: Array.isArray(input?.endpoints) && input.endpoints.length ? input.endpoints : cfg.endpoints }); if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) throw previewPermissionFailure("invalidPreviewPermission"); } catch (error) { return Promise.reject(messages[error?.code] ? error : previewPermissionFailure("previewPermissionUnavailable")); }
  if (!online()) return (db ? commitR4Consent(db, cfg.id, { disclosure }, "offline").catch(() => {}) : Promise.resolve()).then(() => Promise.reject(previewPermissionFailure("previewPermissionOffline")));
  return askReviewDialog({ label: cfg.label, heading: cfg.heading, beforeList: cfg.before(disclosure.source), endpoints: disclosure.endpoints, afterList: cfg.after, allowLabel: cfg.allow, modal: true, document, online, timeoutMs, onSettled: db ? (outcome, expires) => commitR4Consent(db, cfg.id, { disclosure, expires }, map[outcome] || "denied") : null }).then(expires => Object.freeze({ disclosure, expires }));
}
export function authorizeR4WeightsDownload(input, options) { return oneAtATime(() => authorizeR4DisclosureNow("weights", input, options)); }
export function authorizeSpiralCoreInternet(input, options) { return oneAtATime(() => authorizeR4DisclosureNow("spiralcore", input, options)); }
export function mountPreviewPermissions({ list, revoke, document = globalThis.document, mount = button => mountShellAction(button, document) }) {
  const button = element(document, "button", "Preview permissions"); button.type = "button"; button.id = "foundry-preview-permissions";
  button.style.cssText = "padding:0.5rem;background:Canvas;color:CanvasText;border:1px solid;border-radius:0.5rem;font:inherit";
  button.addEventListener("click", async () => {
    let dialog;
    try {
      dialog = makeDialog(document, "Stored preview permissions", "Stored preview permissions");
      const status = element(document, "p", "Loading permissions"); status.setAttribute("role", "status"); dialog.append(status);
      const close = element(document, "button", "Close permissions"); close.type = "button"; const dismiss = () => { dialog.remove(); button.focus(); }; close.addEventListener("click", dismiss); dialog.addEventListener("cancel", event => { event.preventDefault(); dismiss(); }); dialog.append(close); document.body.append(dialog); dialog.showModal(); close.focus();
      const rows = await list(); status.textContent = rows.length ? "Revoke access to stop future authorized preview requests." : "No stored preview network permissions.";
      for (const row of rows) {
        const section = element(document, "section"), label = element(document, "p", `${row.source}\n${row.endpoints.join(", ")}`), remove = element(document, "button", "Revoke preview"); remove.type = "button";
        remove.addEventListener("click", async () => { remove.disabled = true; try { await revoke(row.id); section.remove(); status.textContent = "Preview permission revoked"; close.focus(); } catch { status.textContent = messages.previewPermissionStorageFailed; remove.disabled = false; } });
        section.append(label, remove); dialog.append(section);
      }
    } catch { if (dialog) dialog.append(element(document, "p", messages.previewPermissionStorageFailed)); }
  });
  return mount(button);
}
