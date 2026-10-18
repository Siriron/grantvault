import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Package, User, CheckCircle2, XCircle,
  AlertTriangle, Clock, ExternalLink, ChevronDown, ChevronUp, RefreshCw
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { api, write } from "@/lib/genlayer";
import { ensureStudionet } from "@/lib/wallet";
import { formatReward, formatDeadline, formatDate, isPast, shortAddress, bumpLabel } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { TxPanel } from "@/components/TxPanel";
import type { Vault, VaultAttempt, TxStage } from "@/lib/types";
import { EXPLORER_URL } from "@/config/chains";
import { SCENARIOS, parseTag, suggestedVersion } from "@/lib/guide";

const glass = {
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.68)",
  boxShadow: "0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)",
} as React.CSSProperties;

const inner = {
  background: "rgba(255,255,255,0.46)",
  border: "1px solid rgba(255,255,255,0.56)",
} as React.CSSProperties;

const RECOVERY_DELAY_SECONDS = 604800; // must match RECOVERY_DELAY in the contract

const spectral = "linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)";

function outcomeIcon(outcome: string) {
  if (outcome === "GRANTED") return <CheckCircle2 className="size-4" style={{ color: "var(--success)" }} />;
  if (outcome === "NOT_GRANTED") return <XCircle className="size-4" style={{ color: "var(--danger)" }} />;
  return <Clock className="size-4" style={{ color: "#7c4a00" }} />;
}

function AttemptRow({ attempt }: { attempt: VaultAttempt }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        style={{ background: "rgba(18,45,69,0.03)" }}
        onClick={() => setOpen((v) => !v)}
      >
        {outcomeIcon(attempt.outcome)}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold mono" style={{ color: "var(--ink)" }}>
            v{attempt.version}
          </span>
          <span className="ml-2 text-xs" style={{ color: "var(--muted)" }}>
            {formatDate(attempt.at)}
          </span>
        </div>
        <StatusBadge status={attempt.outcome} />
        {open ? <ChevronUp className="size-3.5 shrink-0" style={{ color: "var(--subtle)" }} /> : <ChevronDown className="size-3.5 shrink-0" style={{ color: "var(--subtle)" }} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2">
              <p className="text-xs" style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>
                {attempt.explanation || "No explanation provided."}
              </p>
              {attempt.publisher_found && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: "var(--muted)" }}>Publisher found:</span>
                  <code className="mono text-xs" style={{ color: "var(--ink-2)" }}>{attempt.publisher_found}</code>
                </div>
              )}
              {attempt.published_at && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: "var(--muted)" }}>Published (npm time map):</span>
                  <code className="mono text-xs" style={{ color: "var(--ink-2)" }}>{attempt.published_at}</code>
                </div>
              )}
              {attempt.source_digest && (
                <div>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>Source digest (registry release record):</span>
                  <code className="mono text-xs block mt-0.5 break-all" style={{ color: "var(--subtle)" }}>
                    {attempt.source_digest}
                  </code>
                </div>
              )}
              {attempt.decision_digest && (
                <div>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>Decision digest (terms, window, inputs):</span>
                  <code className="mono text-xs block mt-0.5 break-all" style={{ color: "var(--subtle)" }}>
                    {attempt.decision_digest}
                  </code>
                </div>
              )}
              {attempt.evidence && (
                <details>
                  <summary className="text-xs cursor-pointer" style={{ color: "var(--muted)" }}>Release facts the verdict used</summary>
                  <code className="mono text-xs block mt-1 break-all" style={{ color: "var(--subtle)" }}>
                    {attempt.evidence}
                  </code>
                </details>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionSection({
  vault,
  address,
  provider,
  onRefresh,
}: {
  vault: Vault;
  address: string;
  provider: unknown;
  onRefresh: () => void;
}) {
  const [stage, setStage] = useState<TxStage>("idle");
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(() => suggestedVersion(vault));

  const isFunder = address.toLowerCase() === vault.funder.toLowerCase();
  const isMaintainer = address.toLowerCase() === vault.maintainer.toLowerCase();
  const deadlinePassed = isPast(vault.deadline);

  async function doWrite(name: string, args: unknown[], value = 0n) {
    if (!provider) return;
    setBusy(true);
    setStage("wallet");
    setTxError("");
    try {
      await ensureStudionet(provider as never);
      await write(
        address as `0x${string}`,
        provider as never,
        name,
        args,
        value,
        (p) => {
          setTxHash(p.hash);
          if (p.status === "SUBMITTED") setStage("submitted");
          else if (p.status === "ACCEPTED") setStage("accepted");
          else if (p.status === "FINALIZED") { setStage("finalized"); setTimeout(onRefresh, 1200); }
          else if (p.status === "TRACKING") setStage("tracking");
          else if (p.status === "FAILED") { setStage("failed"); setTxError(p.error ?? ""); }
        }
      );
    } catch (e) {
      setStage("failed");
      setTxError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Accept */}
      {vault.status === "OPEN" && isMaintainer && (
        <button
          disabled={busy}
          onClick={() => void doWrite("accept_grant", [vault.id])}
          className="w-full rounded-2xl py-3 text-sm font-semibold text-white disabled:opacity-40 transition-all hover:scale-[1.01]"
          style={{ background: "var(--accent)" }}
        >
          Accept Grant Terms
        </button>
      )}

      {/* Cancel */}
      {vault.status === "OPEN" && isFunder && (
        <button
          disabled={busy}
          onClick={() => void doWrite("cancel_vault", [vault.id])}
          className="w-full rounded-2xl py-3 text-sm font-semibold disabled:opacity-40 transition-all hover:scale-[1.01]"
          style={{ background: "rgba(186,43,76,0.10)", color: "var(--danger)" }}
        >
          Cancel &amp; Reclaim
        </button>
      )}

      {/* Expire */}
      {(vault.status === "OPEN" || vault.status === "ACTIVE") && deadlinePassed && (
        <button
          disabled={busy}
          onClick={() => void doWrite("close_expired", [vault.id])}
          className="w-full rounded-2xl py-2.5 text-xs font-semibold disabled:opacity-40 transition-all"
          style={{ background: "rgba(18,45,69,0.06)", color: "var(--ink-2)" }}
        >
          Close Expired Vault
        </button>
      )}

      {/* Submit release */}
      {vault.status === "ACTIVE" && isMaintainer && (
        <div className="rounded-2xl overflow-hidden" style={glass}>
          <div className="h-0.5" style={{ background: spectral }} />
          <div className="p-4">
            <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: "var(--muted)", letterSpacing: "0.07em" }}>
              Submit Release
            </p>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl px-3 py-2 text-sm mono outline-none"
                style={inner}
                placeholder="e.g. 2.0.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
              <button
                disabled={busy || !version.trim()}
                onClick={() => void doWrite("evaluate_release", [vault.id, version.trim()])}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 transition-all hover:scale-[1.01]"
                style={{ background: "var(--accent)" }}
              >
                Evaluate
              </button>
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
              Validators will fetch{" "}
              <code className="mono">{`registry.npmjs.org/${vault.package}`}</code>{" "}
              (the package document, which holds the publish-time map) and verify publisher, that the release was
              published between acceptance and the deadline, the semver bump, and the release facts.
            </p>
          </div>
        </div>
      )}

      {/* Claim */}
      {vault.status === "PAYABLE" && isMaintainer && vault.settlement_state === "PAYABLE" && (
        <button
          disabled={busy}
          onClick={() => void doWrite("claim_funds", [vault.id])}
          className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 transition-all hover:scale-[1.01]"
          style={{ background: "var(--success)" }}
        >
          Claim {formatReward(vault.reward)} GEN
        </button>
      )}

      {/* Refund */}
      {(vault.status === "CANCELLED" || vault.status === "EXPIRED") &&
        isFunder &&
        vault.settlement_state === "REFUNDABLE" && (
          <button
            disabled={busy}
            onClick={() => void doWrite("claim_funds", [vault.id])}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 transition-all hover:scale-[1.01]"
            style={{ background: "var(--accent)" }}
          >
            Claim Refund
          </button>
        )}

      {/* Dispatched transfers: delivery must be proven from the contract balance before the vault is settled */}
      {(vault.settlement_state === "PAYOUT_DISPATCHED" || vault.settlement_state === "REFUND_DISPATCHED") && (
        <div className="rounded-2xl p-4 space-y-3" style={inner}>
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            Transfer of {formatReward(vault.dispatched_amount)} GEN sent, delivery not confirmed yet
          </p>
          <p className="text-xs" style={{ color: "var(--muted)", lineHeight: 1.6 }}>
            Value transfers are queued until the transaction finalizes. Anyone can confirm delivery once the contract
            balance shows the GEN has left. If it never leaves, the transfer can be reopened after 7 days; it cannot be
            paid twice while it is in this state.
          </p>
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => void doWrite("confirm_delivery", [vault.id])}
              className="flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--accent)" }}
            >
              Confirm delivery
            </button>
            {isPast(vault.dispatched_at + RECOVERY_DELAY_SECONDS) && (
              <button
                disabled={busy}
                onClick={() => void doWrite("recover_dispatch", [vault.id])}
                className="flex-1 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40"
                style={{ border: "1px solid var(--border)", color: "var(--ink-2)" }}
              >
                Reopen failed transfer
              </button>
            )}
          </div>
        </div>
      )}

      <TxPanel stage={stage} hash={txHash} error={txError} />
    </div>
  );
}

export function VaultView({ vaultId, onBack }: { vaultId: string; onBack: () => void }) {
  const { address, connected, provider } = useWallet();
  const [vault, setVault] = useState<Vault | null>(null);
  const [attempts, setAttempts] = useState<VaultAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Refreshes keep the current vault on screen (so a finished transaction panel is not unmounted);
  // only the very first load shows the loading state.
  const load = useCallback(async () => {
    setError("");
    try {
      const [v, a] = await Promise.all([api.vault(vaultId), api.attempts(vaultId)]);
      setVault(v);
      setAttempts(Array.isArray(a) ? a : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vault");
    } finally {
      setLoading(false);
    }
  }, [vaultId]);

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm" style={{ color: "var(--muted)" }}>Loading vault…</p>
      </div>
    );
  }

  if (error || !vault) {
    return (
      <div className="py-8">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--muted)" }}>
          <ArrowLeft className="size-4" /> Back
        </button>
        <div className="rounded-2xl p-4" style={{ background: "rgba(186,43,76,0.07)", border: "1px solid rgba(186,43,76,0.18)" }}>
          <p className="text-sm" style={{ color: "var(--danger)" }}>{error || "Vault not found"}</p>
        </div>
      </div>
    );
  }

  const isPayable = vault.status === "PAYABLE";
  const isFunder = address && address.toLowerCase() === vault.funder.toLowerCase();
  const isMaintainer = address && address.toLowerCase() === vault.maintainer.toLowerCase();

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity" style={{ color: "var(--muted)" }}>
          <ArrowLeft className="size-4" /> Back
        </button>
        <button onClick={() => void load()} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity" style={{ color: "var(--subtle)" }}>
          <RefreshCw className="size-4" />
        </button>
      </div>

      {(() => {
        const tag = parseTag(vault.description);
        const sc = tag ? SCENARIOS.find((s) => s.key === tag.key) : undefined;
        if (!sc) return null;
        return (
          <div className="rounded-2xl p-3" style={{ background: "rgba(95,190,255,0.10)", border: "1px solid rgba(95,190,255,0.28)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--ink)" }}>Test vault · {sc.label}</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)", lineHeight: 1.5 }}>Expected: {sc.expected}</p>
            <a href="#/guide" className="text-xs font-semibold mt-1 inline-block" style={{ color: "var(--accent)" }}>Back to the test guide</a>
          </div>
        );
      })()}

      {/* Hero card */}
      <div className="rounded-3xl overflow-hidden" style={{ ...glass, border: isPayable ? "none" : glass.border }}>
        {isPayable && <div className="h-1" style={{ background: spectral }} />}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: "var(--accent)" }}
              >
                <Package className="size-6 text-white" />
              </div>
              <div>
                <h2 className="display text-xl font-bold" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
                  {vault.package}
                </h2>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  min {bumpLabel(vault.min_bump)} bump · by {vault.publisher_name}
                </p>
              </div>
            </div>
            <StatusBadge status={vault.status} />
          </div>

          <p className="text-sm mb-4" style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>
            {vault.description}
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Reward", value: `${formatReward(vault.reward)} GEN` },
              { label: "Deadline", value: formatDeadline(vault.deadline) },
              { label: "Attempts", value: String(vault.attempt_count) },
            ].map((s) => (
              <div key={s.label} className="rounded-xl px-3 py-2" style={{ background: "rgba(18,45,69,0.05)" }}>
                <p className="text-xs" style={{ color: "var(--muted)" }}>{s.label}</p>
                <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--ink)" }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Parties */}
          <div className="space-y-2">
            {[
              { icon: User, label: "Funder", addr: vault.funder, tag: isFunder ? "you" : "" },
              { icon: Package, label: "Maintainer", addr: vault.maintainer, tag: isMaintainer ? "you" : "" },
            ].map(({ icon: Icon, label, addr, tag }) => (
              <div key={label} className="flex items-center gap-2.5 rounded-xl px-3 py-2" style={inner}>
                <Icon className="size-3.5 shrink-0" style={{ color: "var(--subtle)" }} />
                <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
                <code className="mono text-xs flex-1" style={{ color: "var(--ink-2)" }}>{shortAddress(addr)}</code>
                {tag && (
                  <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: "rgba(18,45,69,0.08)", color: "var(--ink-2)" }}>
                    {tag}
                  </span>
                )}
                <a
                  href={`${EXPLORER_URL}/address/${addr}`}
                  target="_blank"
                  rel="noreferrer"
                  className="opacity-50 hover:opacity-100"
                >
                  <ExternalLink className="size-3" style={{ color: "var(--ink-2)" }} />
                </a>
              </div>
            ))}
          </div>

          {/* Last outcome */}
          {vault.outcome && (
            <div
              className="mt-4 rounded-xl px-3 py-2"
              style={{
                background: vault.outcome === "GRANTED" ? "rgba(26,128,71,0.08)" : vault.outcome === "NOT_GRANTED" ? "rgba(186,43,76,0.08)" : "rgba(124,74,0,0.08)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                {outcomeIcon(vault.outcome)}
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)", letterSpacing: "0.07em" }}>
                  Last outcome
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>
                {vault.explanation}
              </p>
              {vault.target_version && (
                <p className="text-xs mt-1 font-medium mono" style={{ color: "var(--ink-2)" }}>
                  v{vault.target_version}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {connected && (isFunder || isMaintainer) && (
        <ActionSection vault={vault} address={address} provider={provider} onRefresh={() => void load()} />
      )}

      {/* Attempt history */}
      {attempts.length > 0 && (
        <div className="rounded-2xl p-4" style={glass}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4" style={{ color: "var(--muted)" }} />
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)", letterSpacing: "0.07em" }}>
              Evaluation History
            </p>
          </div>
          <div className="space-y-2">
            {[...attempts].reverse().map((a, i) => (
              <AttemptRow key={i} attempt={a} />
            ))}
          </div>
        </div>
      )}

      {/* Vault metadata */}
      <div className="rounded-2xl p-4" style={{ ...glass, opacity: 0.8 }}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {[
            { label: "Vault ID", value: vault.id },
            { label: "Created", value: formatDate(vault.created_at) },
            { label: "Accepted", value: vault.accepted_at ? formatDate(vault.accepted_at) : "—" },
            { label: "Closed", value: vault.closed_at ? formatDate(vault.closed_at) : "—" },
            { label: "Settlement", value: vault.settlement_state },
          ].map((row) => (
            <div key={row.label}>
              <p className="text-xs" style={{ color: "var(--muted)" }}>{row.label}</p>
              <p className="text-xs font-semibold mono" style={{ color: "var(--ink-2)" }}>{row.value}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
