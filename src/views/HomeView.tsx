import { useState, useEffect, useCallback } from "react";
import { errorMessage } from "@/lib/format";
import { motion } from "framer-motion";
import { Package, Plus, Wallet, AlertTriangle } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { api } from "@/lib/genlayer";
import { isConfigured } from "@/config/chains";
import type { Vault } from "@/lib/types";
import { VaultCard } from "@/components/VaultCard";

const glass = {
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.68)",
  boxShadow: "0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)",
} as React.CSSProperties;

export function HomeView({ onNew, onVault }: { onNew: () => void; onVault: (id: string) => void }) {
  const { address, connected, connect, onStudionet, switchNetwork } = useWallet();
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!connected || !address || !isConfigured()) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.forWallet(address);
      setVaults(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(errorMessage(e, "Failed to load vaults"));
    } finally {
      setLoading(false);
    }
  }, [connected, address]);

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  return (
    <div>
      {/* Hero section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="flex size-10 items-center justify-center rounded-2xl"
            style={{ background: "var(--accent)" }}
          >
            <Package className="size-5 text-white" />
          </div>
          <div>
            <h1
              className="display text-2xl font-bold"
              style={{ color: "var(--ink)", letterSpacing: "-0.03em" }}
            >
              GrantVault
            </h1>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              npm release escrow on GenLayer
            </p>
          </div>
        </div>
        <p className="text-sm mt-3" style={{ color: "var(--ink-2)", maxWidth: "38ch" }}>
          Fund OSS maintainers to ship promised releases. Validators independently verify npm registry evidence. No adjudicators, no backends.
        </p>
      </motion.div>

      {/* Not configured banner */}
      {!isConfigured() && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-2xl p-4 flex items-start gap-3"
          style={{ background: "rgba(186,43,76,0.07)", border: "1px solid rgba(186,43,76,0.18)" }}
        >
          <AlertTriangle className="size-4 shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>Contract not configured</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>
              Deploy <code className="mono">grantvault.py</code> to Studionet, then set{" "}
              <code className="mono">CONTRACT_ADDRESS</code> in <code className="mono">src/config/chains.ts</code>.
            </p>
          </div>
        </motion.div>
      )}

      {/* Connect / Switch */}
      {!connected ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-6 text-center"
          style={glass}
        >
          <Wallet className="size-8 mx-auto mb-3" style={{ color: "var(--subtle)" }} />
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--ink)" }}>
            Connect your wallet
          </p>
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
            MetaMask, Rabby, or any EIP-1193 wallet
          </p>
          <button
            onClick={() => void connect()}
            className="rounded-2xl px-6 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "var(--accent)" }}
          >
            Connect Wallet
          </button>
        </motion.div>
      ) : !onStudionet ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 text-center"
          style={glass}
        >
          <p className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>
            Switch to GenLayer Studionet
          </p>
          <button
            onClick={() => void switchNetwork()}
            className="rounded-2xl px-6 py-2.5 text-sm font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            Switch Network
          </button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {/* Action row */}
          <div className="flex gap-2">
            <button
              onClick={onNew}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: "var(--accent)" }}
            >
              <Plus className="size-4" />
              New Vault
            </button>
            <button
              onClick={() => void load()}
              className="rounded-2xl px-4 py-3 text-sm font-medium transition-all hover:scale-[1.01]"
              style={{ background: "rgba(18,45,69,0.07)", color: "var(--ink-2)" }}
            >
              Refresh
            </button>
          </div>

          {/* Vaults list */}
          {loading ? (
            <div className="rounded-2xl p-8 text-center" style={glass}>
              <p className="text-sm" style={{ color: "var(--muted)" }}>Loading vaults…</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl p-4 text-sm" style={{ ...glass, color: "var(--danger)" }}>
              {error}
            </div>
          ) : vaults.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={glass}>
              <Package className="size-8 mx-auto mb-3" style={{ color: "var(--subtle)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>No vaults yet</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                Create a vault to fund an npm release, or ask a funder to designate you as maintainer.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {vaults.map((v, i) => (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                >
                  <VaultCard
                    vault={v}
                    onClick={() => onVault(v.id)}
                    highlight={v.status === "PAYABLE"}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
