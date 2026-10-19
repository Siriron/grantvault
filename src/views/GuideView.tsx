import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Copy, RefreshCw } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { api } from "@/lib/genlayer";
import { EXPLORER_URL } from "@/config/chains";
import { errorMessage, shortAddress } from "@/lib/format";
import type { MinBump, Vault, VaultAttempt } from "@/lib/types";
import {
  SCENARIOS, clearRun, getRun, newRun, prefillFor, readTxLog, resumeRun, saveRun, setPrefill, tagFor, txLogText,
  type LoggedTx, type Run, type ScenarioKey,
} from "@/lib/guide";

const glass = {
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.68)",
  boxShadow: "0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)",
} as React.CSSProperties;
const inner = { background: "rgba(255,255,255,0.46)", border: "1px solid rgba(255,255,255,0.56)" } as React.CSSProperties;

type Role = "funder" | "maintainer" | "anyone";
interface Step {
  n: number;
  title: string;
  who: Role;
  what: string;
  done: boolean;
  detail?: string;
  action?: { label: string; run: () => void };
}

const lc = (s?: string) => (s ?? "").toLowerCase();
const isAddr = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s.trim());

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>{label}</label>
      {children}
    </div>
  );
}
const inputStyle = { ...inner, color: "var(--ink)" } as React.CSSProperties;

export function GuideView({ onBack, go }: { onBack: () => void; go: (to: string) => void }) {
  const { address, connected, connect } = useWallet();
  const [run, setRun] = useState<Run>(() => getRun() ?? newRun(null));
  const [vault, setVault] = useState<Vault | null>(null);
  const [attempts, setAttempts] = useState<VaultAttempt[]>([]);
  const [log, setLog] = useState<LoggedTx[]>(() => readTxLog());
  const [copied, setCopied] = useState(false);
  const [resumeId, setResumeId] = useState("");
  const [resumeErr, setResumeErr] = useState("");
  const [loadErr, setLoadErr] = useState("");

  const sc = SCENARIOS.find((s) => s.key === run.scenario) ?? SCENARIOS[0];
  const tag = tagFor(run.suffix, run.scenario);

  const refresh = useCallback(async () => {
    setLog(readTxLog());
    if (!connected || !address) return;
    try {
      // The vault list of a wallet contains vaults where it is funder OR maintainer, so either wallet finds it.
      const list = await api.forWallet(address);
      const found = (Array.isArray(list) ? list : [])
        .filter((v) => v.description.includes(tag))
        .sort((a, b) => Number(b.id) - Number(a.id))[0] ?? null;
      setVault(found);
      setAttempts(found ? ((await api.attempts(found.id)) ?? []) : []);
      setLoadErr("");
    } catch (e) {
      setLoadErr(errorMessage(e, "Could not read the contract"));
    }
  }, [connected, address, tag]);

  useEffect(() => {
    const go1 = async () => { await refresh(); };
    void go1();
    const id = setInterval(() => { void go1(); }, 20000); // StudioNet is rate limited: no faster
    return () => clearInterval(id);
  }, [refresh]);

  function update(patch: Partial<Run>) {
    const next = { ...run, ...patch };
    setRun(next);
    saveRun(next);
  }

  function pickScenario(key: ScenarioKey) {
    update({ scenario: key });
    setVault(null);
    setAttempts([]);
  }

  function startNew() {
    const next = newRun(run);
    setRun(next);
    setVault(null);
    setAttempts([]);
    setLog([]);
    try { localStorage.removeItem("gv.txlog"); } catch { /* ignore */ }
  }

  function startOver() {
    clearRun();
    setRun(newRun(null));
    setVault(null);
    setAttempts([]);
    setLog([]);
  }

  function resume() {
    const r = resumeRun(resumeId, run);
    if (!r) { setResumeErr("Enter the run ID: 4 to 16 letters or digits."); return; }
    setResumeErr("");
    setRun(r);
    setVault(null);
  }

  async function copyLog() {
    try {
      await navigator.clipboard.writeText(txLogText(log));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  }

  const needsMaintainer = !isAddr(run.maintainer);
  const ownOk = !sc.needsOwnPackage || (run.pkg.trim() && run.npmUser.trim() && /^\d+\.\d+\.\d+$/.test(run.version.trim()));
  const ready = !needsMaintainer && !!ownOk;
  const last = attempts[attempts.length - 1];
  const openVault = () => { if (vault) go(`/vault/${vault.id}`); };

  const createStep: Step = {
    n: 1, title: "Create the vault", who: "funder",
    what: `Connected as the funder wallet. The form opens pre-filled (tag ${tag} in the description is how this page finds the vault). Press Lock GEN.`,
    done: !!vault,
    detail: vault ? `Vault ${vault.id} created` : undefined,
    action: ready ? { label: "Open pre-filled form", run: () => { setPrefill(prefillFor(run, run.scenario)); go("/new"); } } : undefined,
  };
  const acceptStep: Step = {
    n: 2, title: "Accept the grant", who: "maintainer",
    what: "Switch to the maintainer wallet, open the vault and press Accept Grant Terms. The acceptance time starts the release window.",
    done: !!vault && vault.accepted_at > 0,
    action: vault ? { label: "Open vault", run: openVault } : undefined,
  };
  const evalDetail = last ? `${last.outcome}: ${vault?.explanation ?? ""}` : undefined;
  const evaluateStep = (n: number, version: string): Step => ({
    n, title: "Submit the release for judgment", who: "maintainer",
    what: `As the maintainer, open the vault, enter version ${version} (pre-filled) and press Evaluate. Validators fetch registry.npmjs.org/${vault?.package ?? "<package>"} and reach consensus; allow a few minutes.`,
    done: !!vault && vault.attempt_count > 0,
    detail: evalDetail,
    action: vault ? { label: "Open vault", run: openVault } : undefined,
  });

  const steps: Step[] = (() => {
    switch (run.scenario) {
      case "A": case "B": case "C": {
        const v = run.scenario === "C" ? "99.0.0" : "3.0.1";
        return [createStep, acceptStep, evaluateStep(3, v)];
      }
      case "D": return [
        createStep, acceptStep,
        {
          n: 3, title: "Publish a new npm release", who: "anyone",
          what: `Only after step 2: publish version ${run.version || "<next version>"} of ${run.pkg || "your package"} from the npm account ${run.npmUser || "<npm user>"} (for example npm version ${run.bump} then npm publish). It must be a ${run.bump} bump or larger over your previous release.`,
          done: !!vault && vault.attempt_count > 0,
        },
        evaluateStep(4, run.version || "<next version>"),
        {
          n: 5, title: "Claim the payout", who: "maintainer",
          what: "After GRANTED the vault is PAYABLE. As the maintainer press the Claim button on the vault. One transfer is dispatched.",
          done: !!vault && ["PAYOUT_DISPATCHED", "PAYOUT_SETTLED"].includes(vault.settlement_state),
          detail: vault ? `Settlement: ${vault.settlement_state}` : undefined,
          action: vault ? { label: "Open vault", run: openVault } : undefined,
        },
        {
          n: 6, title: "Confirm delivery", who: "anyone",
          what: "After the claim transaction is FINALIZED, any wallet presses Confirm delivery. It only succeeds once the contract balance shows the GEN left.",
          done: !!vault && vault.settlement_state === "PAYOUT_SETTLED",
          action: vault ? { label: "Open vault", run: openVault } : undefined,
        },
      ];
      default: return [
        createStep,
        {
          n: 2, title: "Cancel the vault", who: "funder",
          what: "As the funder open the vault and press Cancel & Reclaim (only possible before the maintainer accepts).",
          done: !!vault && vault.status === "CANCELLED",
          action: vault ? { label: "Open vault", run: openVault } : undefined,
        },
        {
          n: 3, title: "Claim the refund", who: "funder",
          what: "Press Claim Refund. One transfer is dispatched to the funder.",
          done: !!vault && ["REFUND_DISPATCHED", "REFUND_SETTLED"].includes(vault.settlement_state),
          detail: vault ? `Settlement: ${vault.settlement_state}` : undefined,
          action: vault ? { label: "Open vault", run: openVault } : undefined,
        },
        {
          n: 4, title: "Confirm delivery", who: "anyone",
          what: "After the claim is FINALIZED, any wallet presses Confirm delivery.",
          done: !!vault && vault.settlement_state === "REFUND_SETTLED",
          action: vault ? { label: "Open vault", run: openVault } : undefined,
        },
      ];
    }
  })();

  const firstOpen = steps.findIndex((s) => !s.done);
  const roleOk = (who: Role): boolean | null => {
    if (!connected || who === "anyone") return null;
    if (who === "maintainer") return lc(address) === lc(vault?.maintainer ?? run.maintainer);
    return vault ? lc(address) === lc(vault.funder) : lc(address) !== lc(run.maintainer);
  };
  const outcomeMatches = (() => {
    if (!last) return null;
    const want: Record<ScenarioKey, string> = { A: "NOT_GRANTED", B: "NOT_GRANTED", C: "INCONCLUSIVE", D: "GRANTED", E: "" };
    return want[run.scenario] ? last.outcome === want[run.scenario] : null;
  })();

  return (
    <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35 }}>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-5 hover:opacity-70 transition-opacity" style={{ color: "var(--muted)" }}>
        <ArrowLeft className="size-4" /> Back
      </button>
      <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--accent)" }}>Test guide</p>
      <h2 className="display text-2xl font-bold" style={{ color: "var(--ink)", letterSpacing: "-0.03em" }}>Run a test scenario</h2>
      <p className="text-sm mt-1 mb-5" style={{ color: "var(--muted)", lineHeight: 1.6 }}>
        Pick a scenario, follow the steps. Forms open pre-filled; each step turns green only when the contract shows the result.
        Every action is a real StudioNet transaction with validator consensus; they appear in the log below.
      </p>

      <div className="rounded-3xl p-5 space-y-4 mb-4" style={glass}>
        <Field label="Scenario">
          <select className="w-full rounded-2xl px-3 py-2.5 text-sm outline-none" style={inputStyle} value={run.scenario}
            onChange={(e) => pickScenario(e.target.value as ScenarioKey)}>
            {SCENARIOS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <p className="text-xs mt-2" style={{ color: "var(--muted)", lineHeight: 1.5 }}>{sc.summary}</p>
          <p className="text-xs mt-1 font-semibold" style={{ color: "var(--ink-2)" }}>Expected: {sc.expected}</p>
        </Field>

        <Field label="Maintainer wallet (a second wallet, not the funder)">
          <input className="w-full rounded-2xl px-3 py-2.5 text-sm mono outline-none" style={inputStyle} placeholder="0x…" value={run.maintainer}
            onChange={(e) => update({ maintainer: e.target.value.trim() })} />
          {run.maintainer && !isAddr(run.maintainer) && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>Enter a full 0x… address (42 characters).</p>}
          {isAddr(run.maintainer) && connected && lc(run.maintainer) === lc(address) && (
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>You are connected as the maintainer. Switch to the funder wallet to create the vault.</p>
          )}
        </Field>

        {sc.needsOwnPackage && (
          <div className="space-y-3">
            <Field label="Your npm package">
              <input className="w-full rounded-2xl px-3 py-2.5 text-sm outline-none" style={inputStyle} placeholder="my-package" value={run.pkg}
                onChange={(e) => update({ pkg: e.target.value.trim().toLowerCase() })} />
            </Field>
            <Field label="Your npm username (the account that publishes it)">
              <input className="w-full rounded-2xl px-3 py-2.5 text-sm outline-none" style={inputStyle} placeholder="npm-username" value={run.npmUser}
                onChange={(e) => update({ npmUser: e.target.value.trim() })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Next version to publish">
                <input className="w-full rounded-2xl px-3 py-2.5 text-sm mono outline-none" style={inputStyle} placeholder="1.0.1" value={run.version}
                  onChange={(e) => update({ version: e.target.value.trim() })} />
              </Field>
              <Field label="Minimum bump">
                <select className="w-full rounded-2xl px-3 py-2.5 text-sm outline-none" style={inputStyle} value={run.bump}
                  onChange={(e) => update({ bump: e.target.value as MinBump })}>
                  <option value="patch">patch</option><option value="minor">minor</option><option value="major">major</option>
                </select>
              </Field>
            </div>
          </div>
        )}

        <div className="text-xs" style={{ color: "var(--muted)" }}>
          Wallet: {connected ? <code className="mono">{shortAddress(address)}</code> : (
            <button onClick={() => void connect()} className="font-semibold" style={{ color: "var(--accent)" }}>Connect wallet</button>
          )}
          {" · "}Run <code className="mono">{run.suffix}</code>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => void refresh()} className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold" style={{ border: "1px solid var(--border)", color: "var(--ink-2)" }}>
            <RefreshCw className="size-3" /> Refresh
          </button>
          <button onClick={startNew} className="rounded-xl px-3 py-1.5 text-xs font-semibold" style={{ border: "1px solid var(--border)", color: "var(--ink-2)" }}>New run</button>
          <button onClick={startOver} className="rounded-xl px-3 py-1.5 text-xs font-semibold" style={{ border: "1px solid var(--border)", color: "var(--ink-2)" }}>Clear all</button>
        </div>
        <div>
          <div className="flex gap-2">
            <input className="flex-1 rounded-2xl px-3 py-2 text-xs mono outline-none" style={inputStyle} placeholder="resume run ID" value={resumeId} onChange={(e) => setResumeId(e.target.value)} />
            <button onClick={resume} className="rounded-xl px-3 py-1.5 text-xs font-semibold" style={{ border: "1px solid var(--border)", color: "var(--ink-2)" }}>Resume</button>
          </div>
          {resumeErr && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{resumeErr}</p>}
          <p className="text-xs mt-1" style={{ color: "var(--subtle)" }}>Runs live on-chain; this browser only remembers the current run ID and the log.</p>
        </div>
        {loadErr && <p className="text-xs" style={{ color: "var(--danger)" }}>{loadErr}</p>}
      </div>

      {!ready && (
        <p className="text-xs mb-4" style={{ color: "var(--warn, #7c4a00)" }}>
          {needsMaintainer ? "Enter the maintainer wallet address above to enable the steps." : "Fill in your npm package, username and next version (for example 1.0.1) above."}
        </p>
      )}

      <ol className="space-y-3 mb-6">
        {steps.map((s, i) => {
          const state = s.done ? "done" : i === firstOpen ? "next" : "todo";
          const color = state === "done" ? "var(--success)" : state === "next" ? "var(--accent)" : "var(--subtle)";
          const ok = roleOk(s.who);
          return (
            <li key={s.n} className="rounded-2xl p-4" style={{ ...glass, borderColor: color, border: `1px solid ${color}` }}>
              <div className="flex items-start gap-3">
                <span className="mono text-sm font-bold" style={{ color }}>{state === "done" ? <Check className="size-4" /> : s.n}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    {s.title} <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>· {s.who === "anyone" ? "any wallet" : `${s.who} wallet`}</span>
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)", lineHeight: 1.55 }}>{s.what}</p>
                  {s.detail && <p className="mono text-xs mt-1 break-words" style={{ color }}>{s.detail}</p>}
                  {state !== "done" && ok === false && (
                    <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>
                      Switch to the {s.who} wallet{s.who === "maintainer" && isAddr(run.maintainer) ? ` (${shortAddress(run.maintainer)})` : ""} first.
                    </p>
                  )}
                  {s.action && (
                    <button onClick={s.action.run} className="mt-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--accent)" }}>
                      {s.action.label}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {last && outcomeMatches !== null && (
        <p className="text-xs mb-4 font-semibold" style={{ color: outcomeMatches ? "var(--success)" : "var(--danger)" }}>
          Latest verdict {last.outcome} {outcomeMatches ? "matches the expectation for this scenario." : `differs from the expected result. Copy the log and the vault page and send them along.`}
        </p>
      )}

      <div className="rounded-3xl p-5" style={glass}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Transaction log (this browser)</p>
          <button onClick={() => void copyLog()} disabled={log.length === 0} className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-40" style={{ border: "1px solid var(--border)", color: "var(--ink-2)" }}>
            <Copy className="size-3" /> {copied ? "Copied" : "Copy log"}
          </button>
        </div>
        {log.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--muted)" }}>Confirmed transactions appear here with their hash, status and execution result. Copy the log as proof.</p>
        ) : (
          <ul className="space-y-2">
            {log.map((t) => (
              <li key={t.hash} className="rounded-xl p-2.5" style={inner}>
                <p className="text-xs font-semibold" style={{ color: t.status === "FAILED" ? "var(--danger)" : "var(--ink)" }}>
                  {t.label} · {t.status}{t.execution ? ` · ${t.execution}` : ""}
                </p>
                <a href={`${EXPLORER_URL}/tx/${t.hash}`} target="_blank" rel="noreferrer" className="mono text-xs break-all" style={{ color: "var(--accent)" }}>{t.hash}</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
