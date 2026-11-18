import { useEffect, useRef, useState } from "react";
import { Check, Github, GitBranch, GitCommit, GitPullRequest, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLoadApp } from "@/hooks/useLoadApp";
import { showError, showSuccess } from "@/lib/toast";

export const DEFAULT_SPIRALCORE_RELAY_WS_URL = "wss://lexlean-r4-spiralcore-relay.swarm-relay-cloud-8d31a122.workers.dev/spvs";
type R4Res = Record<string, unknown> & { ok?: boolean; error?: string; message?: string; html_url?: string; pr_url?: string; url?: string; branch?: string; truncated?: boolean; lazy_paths?: unknown[]; data?: { lazy_paths?: unknown[] } };
type R4Api = { DEFAULT_SPIRALCORE_RELAY_WS_URL?: string; hasGithubToken?: () => Promise<boolean>; getRelayUrl?: () => string; setRelayUrl?: (u: string) => Promise<string>; gitAction?: (op: string, a?: Record<string, unknown>) => Promise<R4Res>; onTelemetry?: (cb: (s: Record<string, unknown>) => void) => () => void };
const r4 = (): R4Api | undefined => (window as unknown as { __host?: { r4Studio?: R4Api } }).__host?.r4Studio;
const msgOf = (e: unknown) => (e instanceof Error ? e.message : String(e || "Operation failed"));

function useGithubConnected() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let live = true; const api = r4();
    api?.hasGithubToken?.().then((ok) => live && setConnected(Boolean(ok))).catch(() => {});
    const off = api?.onTelemetry?.((s) => { if (live && typeof s?.githubConnected === "boolean") setConnected(s.githubConnected); });
    return () => { live = false; off?.(); };
  }, []);
  const saveToken = async (token: string, done?: () => void) => {
    const value = token.trim(); if (!value) throw new Error("Enter a GitHub personal token");
    const res = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${value}`, Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`GitHub rejected personal token (${res.status})`);
    const login = String((await res.json())?.login || "");
    const out = await r4()?.gitAction?.("set_secret", { key: "GITHUB_TOKEN", value });
    if (!out || out.ok === false) throw new Error(out?.error || out?.message || "Failed to store GitHub personal token");
    setConnected(true); done?.(); return login;
  };
  const clearToken = async (done?: () => void) => {
    const out = await r4()?.gitAction?.("set_secret", { key: "GITHUB_TOKEN", value: "" });
    if (out && out.ok === false) throw new Error(out.error || out.message || "Failed to clear GitHub personal token");
    setConnected(false); done?.();
  };
  return { connected, saveToken, clearToken };
}

export function SpiralCoreRelaySetting() {
  const fallback = r4()?.DEFAULT_SPIRALCORE_RELAY_WS_URL || DEFAULT_SPIRALCORE_RELAY_WS_URL;
  const [url, setUrl] = useState(() => r4()?.getRelayUrl?.() || fallback), [busy, setBusy] = useState(false);
  const save = async (next: string) => { setBusy(true); try { setUrl((await r4()?.setRelayUrl?.(next.trim() || fallback)) || next.trim() || fallback); showSuccess("SpiralCore Relay URL updated"); } catch (e) { showError(msgOf(e)); } finally { setBusy(false); } };
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="spiralcore-relay-url" className="text-sm font-medium"><Globe className="size-4 text-muted-foreground" />SpiralCore Relay URL</Label>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void save(fallback)}>Reset</Button>
      </div>
      <div className="flex items-center gap-2"><Input id="spiralcore-relay-url" aria-label="SpiralCore Relay URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={DEFAULT_SPIRALCORE_RELAY_WS_URL} /><Button type="button" size="sm" disabled={busy} onClick={() => void save(url)}>Save</Button></div>
      <p className="text-xs text-muted-foreground">WebSocket relay endpoint bridged into Full SpiralCore Internet sessions.</p>
    </div>
  );
}

export function GitHubIntegration() {
  const { connected, saveToken, clearToken } = useGithubConnected();
  const [token, setToken] = useState(""), [busy, setBusy] = useState(false);
  const connect = async () => { setBusy(true); try { const login = await saveToken(token); setToken(""); showSuccess(login ? `Connected GitHub as ${login}` : "GitHub personal token saved"); } catch (e) { showError(msgOf(e)); } finally { setBusy(false); } };
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="github-personal-token" className="text-sm font-medium"><Github className="size-4" />GitHub personal token</Label>
        {connected && <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void clearToken().then(() => showSuccess("GitHub disconnected")).catch((e) => showError(msgOf(e)))}>Disconnect</Button>}
      </div>
      <div className="flex items-center gap-2"><Input id="github-personal-token" type="password" aria-label="GitHub personal token" placeholder={connected ? "Replace GitHub personal token" : "GitHub personal token"} value={token} onChange={(e) => setToken(e.target.value)} /><Button type="button" size="sm" disabled={busy} onClick={() => void connect()}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Save"}</Button></div>
      <p className="text-xs text-muted-foreground">{connected ? "Stored in this session's MVM secret vault for CORS-direct api.github.com and worker git actions." : "Validated via api.github.com/user and stored only in the active MVM vault."}</p>
    </div>
  );
}

export interface UnconnectedGitHubConnectorProps { appId: number | null; folderName: string; settings?: unknown; refreshSettings?: () => void; expanded?: boolean; linkedRepo?: { org: string; repo: string } }
const GIT_OPS = [["clone", "Clone", Github], ["branch", "Branch", GitBranch], ["commit", "Commit & Push", GitCommit], ["pr", "Open PR", GitPullRequest]] as const;

export function UnconnectedGitHubConnector({ appId, folderName, refreshSettings, linkedRepo }: UnconnectedGitHubConnectorProps) {
  const { app } = useLoadApp(appId), { connected, saveToken, clearToken } = useGithubConnected();
  const [repo, setRepo] = useState(linkedRepo ? `${linkedRepo.org}/${linkedRepo.repo}` : app?.githubOrg && app?.githubRepo ? `${app.githubOrg}/${app.githubRepo}` : "");
  const [branch, setBranch] = useState(app?.githubBranch || ""), [message, setMessage] = useState(`Update ${folderName || "app"}`), [prTitle, setPrTitle] = useState(`Publish ${folderName || "app"}`), [token, setToken] = useState(""), [busyOp, setBusyOp] = useState<string | null>(null), [status, setStatus] = useState(""), [link, setLink] = useState("");
  const appRef = useRef<number | null>(app?.id ?? null);
  useEffect(() => { const switched = appRef.current !== (app?.id ?? null); appRef.current = app?.id ?? null; const nextRepo = linkedRepo ? `${linkedRepo.org}/${linkedRepo.repo}` : app?.githubOrg && app?.githubRepo ? `${app.githubOrg}/${app.githubRepo}` : "", nextBranch = app?.githubBranch || ""; setRepo((prev) => (switched ? nextRepo : prev || nextRepo)); setBranch((prev) => (switched ? nextBranch : prev || nextBranch)); }, [app?.id, app?.githubOrg, app?.githubRepo, app?.githubBranch]);
  const runGit = async (op: "clone" | "branch" | "commit" | "push" | "pr") => {
    const clean = repo.trim(), [org = "", name = ""] = clean.split("/"); if (!clean || !org || !name) return showError("Specify repository as owner/repo");
    const cleanBranch = branch.trim(); if (op === "branch" && !cleanBranch) return showError("Specify branch name");
    setBusyOp(op);
    try { const res = await r4()?.gitAction?.(op, { appId, repo: clean, org, name, ...(cleanBranch ? { branch: cleanBranch } : {}), message: message.trim() || `Update ${folderName || "app"}`, title: prTitle.trim() || message.trim() || `Publish ${folderName || "app"}` }); if (!res || res.ok === false) throw new Error(res?.error || res?.message || `git ${op} failed`); const href = [res.html_url, res.pr_url, res.url].find((u): u is string => typeof u === "string" && u.length > 0) || "", lazyN = Array.isArray(res.lazy_paths) ? res.lazy_paths.length : Array.isArray(res.data?.lazy_paths) ? res.data.lazy_paths.length : 0, trunc = op === "clone" && (res.truncated || lazyN > 0) ? ` (truncated${lazyN > 0 ? `: ${lazyN} lazy path(s) omitted` : ""})` : "", note = (href ? `${op}: ${href}` : `git ${op} completed`) + trunc; setStatus(note); setLink(/^https?:\/\//.test(href) ? href : ""); showSuccess(note); }
    catch (e) { showError(msgOf(e)); } finally { setBusyOp(null); }
  };
  return (
    <div className="space-y-3" data-testid="github-connector">
      {!connected ? (
        <div className="space-y-2 rounded-md border border-border p-3"><Label htmlFor="publish-github-token">GitHub personal token</Label><div className="flex items-center gap-2"><Input id="publish-github-token" type="password" aria-label="GitHub personal token" placeholder="GitHub personal token" value={token} onChange={(e) => setToken(e.target.value)} /><Button type="button" size="sm" disabled={busyOp !== null} onClick={() => void saveToken(token, refreshSettings).then(() => { setToken(""); showSuccess("GitHub personal token saved"); }).catch((e) => showError(msgOf(e)))}>Connect</Button></div></div>
      ) : (
        <div className="flex items-center justify-between text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5 text-foreground"><Check className="size-3.5" /> GitHub personal token configured</span><Button type="button" variant="ghost" size="sm" onClick={() => void clearToken(refreshSettings).then(() => showSuccess("GitHub disconnected")).catch((e) => showError(msgOf(e)))}>Disconnect</Button></div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="github-repo-slug">Repository</Label><Input id="github-repo-slug" placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="github-branch-name">Branch</Label><Input id="github-branch-name" placeholder="feat/foundry-app" value={branch} onChange={(e) => setBranch(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="github-commit-msg">Commit message</Label><Input id="github-commit-msg" value={message} onChange={(e) => setMessage(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="github-pr-title">Pull request title</Label><Input id="github-pr-title" value={prTitle} onChange={(e) => setPrTitle(e.target.value)} /></div>
      </div>
      <div className="flex flex-wrap gap-2">{GIT_OPS.map(([op, label, Icon]) => <Button key={op} type="button" variant={op === "pr" ? "default" : "outline"} size="sm" disabled={busyOp !== null} onClick={() => void runGit(op)}><Icon className="size-3.5" /> {label}</Button>)}</div>
      {status && <p role="status" className="text-xs text-muted-foreground">{link ? <a href={link} target="_blank" rel="noreferrer" className="underline">{status}</a> : status}</p>}
    </div>
  );
}
export function GitHubConnector(props: UnconnectedGitHubConnectorProps) { return <UnconnectedGitHubConnector {...props} />; }
