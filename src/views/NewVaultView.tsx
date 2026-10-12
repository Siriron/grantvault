import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Package, Info } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { api, write } from "@/lib/genlayer";
import { isValidGen, weiFromGen } from "@/lib/format";
import { TxPanel } from "@/components/TxPanel";
import type { TxStage } from "@/lib/types";
import { ensureStudionet } from "@/lib/wallet";

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

const spectral = "linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)";

const BUMP_OPTIONS = [
  { value: "patch", label: "Patch", desc: "1.0.x" },
  { value: "minor", label: "Minor", desc: "1.x.0" },
  { value: "major", label: "Major", desc: "x.0.0" },
] as const;

type MinBump = "patch" | "minor" | "major";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)", letterSpacing: "0.07em" }}>
          {label}
        </label>
        {hint && (
          <span className="group relative">
            <Info className="size-3" style={{ color: "var(--subtle)" }} />
            <span className="absolute left-5 top-0 z-20 hidden group-hover:block w-48 rounded-xl p-2 text-xs shadow-lg" style={{ background: "var(--ink)", color: "white" }}>
              {hint}
            </span>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function NewVaultView({ onBack, onCreated }: { onBack: () => void; onCreated: (id: string) => void }) {
  const { address, provider } = useWallet();
  const [pkg, setPkg] = useState("");
  const [maintainer, setMaintainer] = useState("");
  const [pubName, setPubName] = useState("");
  const [minBump, setMinBump] = useState<MinBump>("minor");
  const [deadlineDays, setDeadlineDays] = useState("30");
  const [rewardGen, setRewardGen] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState<TxStage>("idle");
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!address || !provider) return;
    setBusy(true);
    setStage("wallet");
    setTxError("");
    try {
      await ensureStudionet(provider);
      const deadlineEpoch = Math.floor(Date.now() / 1000) + parseInt(deadlineDays, 10) * 86400;
      const value = weiFromGen(rewardGen);
      const result = await write(
        address as `0x${string}`,
        provider as never,
        "create_vault",
        [maintainer.trim(), pkg.trim(), pubName.trim(), minBump, deadlineEpoch, description.trim()],
        value,
        (p) => {
          setTxHash(p.hash);
          if (p.status === "SUBMITTED") setStage("submitted");
          else if (p.status === "ACCEPTED") setStage("accepted");
          else if (p.status === "FINALIZED") setStage("finalized");
          else if (p.status === "TRACKING") setStage("tracking");
          else if (p.status === "FAILED") { setStage("failed"); setTxError(p.error ?? ""); }
        }
      );
      if (result.status === "FINALIZED") {
        // Resolve the new vault's id from this wallet's own vault list (never from a global counter).
        const mine = await api.forWallet(address);
        const created = mine
          .filter(
            (v) =>
              v.funder.toLowerCase() === address.toLowerCase() &&
              v.maintainer.toLowerCase() === maintainer.trim().toLowerCase() &&
              v.package === pkg.trim().toLowerCase()
          )
          .sort((a, b) => Number(b.id) - Number(a.id))[0];
        setTimeout(() => onCreated(created?.id ?? ""), 1200);
      }
    } catch (e) {
      setStage("failed");
      setTxError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const days = parseInt(deadlineDays, 10);
  const maintainerOk = /^0x[0-9a-fA-F]{40}$/.test(maintainer.trim());
  const valid =
    pkg.trim().length > 0 &&
    maintainerOk &&
    maintainer.trim().toLowerCase() !== address.toLowerCase() &&
    pubName.trim().length > 0 &&
    isValidGen(rewardGen) &&
    Number.isFinite(days) && days >= 1 &&
    description.trim().length >= 12;

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
    >
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm mb-5 hover:opacity-70 transition-opacity"
        style={{ color: "var(--muted)" }}
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      <div className="mb-6">
        <h2 className="display text-2xl font-bold" style={{ color: "var(--ink)", letterSpacing: "-0.03em" }}>
          New Vault
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Lock GEN to fund an OSS maintainer's next npm release.
        </p>
      </div>

      <div className="rounded-3xl overflow-hidden" style={glass}>
        <div className="h-1" style={{ background: spectral }} />
        <div className="p-5 space-y-4">

          <Field label="npm Package" hint="Exact package name (e.g. lodash or @scope/pkg)">
            <div className="flex items-center rounded-2xl px-3 py-2.5 gap-2" style={inner}>
              <Package className="size-4 shrink-0" style={{ color: "var(--subtle)" }} />
              <input
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "var(--ink)" }}
                placeholder="e.g. my-awesome-lib"
                value={pkg}
                onChange={(e) => setPkg(e.target.value)}
              />
            </div>
          </Field>

          <Field label="Maintainer Address" hint="Wallet address of the designated npm maintainer">
            <input
              className="w-full rounded-2xl px-3 py-2.5 text-sm mono outline-none"
              style={{ ...inner, color: "var(--ink)" }}
              placeholder="0x..."
              value={maintainer}
              onChange={(e) => setMaintainer(e.target.value)}
            />
            {maintainer.trim() !== "" && !maintainerOk && (
              <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>Enter a full 0x… wallet address (42 characters).</p>
            )}
            {maintainerOk && maintainer.trim().toLowerCase() === address.toLowerCase() && (
              <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>The maintainer must be a different wallet from the funder.</p>
            )}
          </Field>

          <Field label="npm Publisher Name" hint="The _npmUser.name from the registry — must match exactly">
            <input
              className="w-full rounded-2xl px-3 py-2.5 text-sm outline-none"
              style={{ ...inner, color: "var(--ink)" }}
              placeholder="e.g. alice"
              value={pubName}
              onChange={(e) => setPubName(e.target.value)}
            />
          </Field>

          <Field label="Minimum Bump" hint="Validators will reject a release that doesn't meet this semver bump level">
            <div className="grid grid-cols-3 gap-2">
              {BUMP_OPTIONS.map((b) => (
                <button
                  key={b.value}
                  onClick={() => setMinBump(b.value)}
                  className="rounded-2xl py-2.5 text-sm font-semibold transition-all"
                  style={{
                    background: minBump === b.value ? "var(--accent)" : "rgba(18,45,69,0.06)",
                    color: minBump === b.value ? "white" : "var(--ink-2)",
                  }}
                >
                  {b.label}
                  <span className="block text-xs font-normal opacity-60">{b.desc}</span>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Reward (GEN)">
              <div className="flex items-center rounded-2xl px-3 py-2.5 gap-1.5" style={inner}>
                <input
                  inputMode="decimal"
                  className="flex-1 bg-transparent text-sm tabular-nums outline-none"
                  style={{ color: "var(--ink)" }}
                  placeholder="0.00"
                  value={rewardGen}
                  onChange={(e) => setRewardGen(e.target.value.replace(/[^0-9.]/g, ""))}
                />
                <span className="text-xs font-medium" style={{ color: "var(--subtle)" }}>GEN</span>
              </div>
            </Field>
            <Field label="Deadline (days)">
              <div className="flex items-center rounded-2xl px-3 py-2.5 gap-1.5" style={inner}>
                <input
                  inputMode="numeric"
                  className="flex-1 bg-transparent text-sm tabular-nums outline-none"
                  style={{ color: "var(--ink)" }}
                  placeholder="30"
                  value={deadlineDays}
                  onChange={(e) => setDeadlineDays(e.target.value.replace(/[^0-9]/g, ""))}
                />
                <span className="text-xs font-medium" style={{ color: "var(--subtle)" }}>days</span>
              </div>
            </Field>
          </div>

          <Field label="Description" hint="Describe what this release should accomplish (12–480 chars)">
            <textarea
              className="w-full rounded-2xl px-3 py-2.5 text-sm outline-none resize-none"
              style={{ ...inner, color: "var(--ink)", minHeight: 80 }}
              placeholder="e.g. Ship v2.0.0 with the new async API and full TypeScript types."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={480}
            />
            <p className="text-xs mt-1 text-right" style={{ color: description.length > 440 ? "var(--danger)" : "var(--subtle)" }}>
              {description.length}/480
            </p>
          </Field>

          <button
            disabled={!valid || busy}
            onClick={() => void submit()}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            {busy ? "Creating vault…" : `Lock ${rewardGen || "0"} GEN`}
          </button>
        </div>
      </div>

      <TxPanel stage={stage} hash={txHash} error={txError} />
    </motion.div>
  );
}
