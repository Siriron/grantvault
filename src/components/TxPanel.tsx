import { CheckCircle2, Circle, Clock, Loader2, XCircle, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { TxStage } from "@/lib/types";
import { EXPLORER_URL } from "@/config/chains";

const steps: Array<{ key: Exclude<TxStage, "idle" | "failed" | "tracking" | "unknown">; label: string }> = [
  { key: "wallet",    label: "Wallet signature" },
  { key: "submitted", label: "Submitted to GenLayer" },
  { key: "accepted",  label: "Consensus accepted" },
  { key: "finalized", label: "Finalized" },
];

const glass = {
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.68)",
  boxShadow: "0 8px 32px rgba(18,45,69,0.08)",
} as React.CSSProperties;

export function TxPanel({
  stage,
  hash,
  error,
}: {
  stage: TxStage;
  hash?: string;
  error?: string;
}) {
  if (stage === "idle") return null;

  const isTracking = stage === "tracking" || stage === "unknown";
  const isFailed = stage === "failed";
  const currentIndex = isFailed
    ? -1
    : isTracking
    ? 1
    : steps.findIndex((s) => s.key === stage);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="rounded-2xl p-4 mt-4"
        style={glass}
      >
        <div className="mb-3 flex items-center gap-2">
          {isFailed ? (
            <XCircle className="size-4" style={{ color: "var(--danger)" }} />
          ) : isTracking ? (
            <Clock className="size-4" style={{ color: "#7c4a00" }} />
          ) : stage === "finalized" ? (
            <CheckCircle2 className="size-4" style={{ color: "var(--success)" }} />
          ) : (
            <Loader2 className="size-4 animate-spin" style={{ color: "var(--accent)" }} />
          )}
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            {isFailed ? "Failed" : isTracking ? "Tracking" : stage}
          </span>
        </div>

        {isFailed && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error || "Transaction could not complete."}
          </p>
        )}

        {isTracking && (
          <p className="text-sm" style={{ color: "#7c4a00" }}>
            {error || "Transaction submitted — awaiting GenLayer finality."}
          </p>
        )}

        {!isFailed && !isTracking && (
          <ol className="space-y-2">
            {steps.map((s, i) => {
              const done = i < currentIndex;
              const active = i === currentIndex;
              return (
                <li key={s.key} className="flex items-center gap-2.5">
                  {done ? (
                    <CheckCircle2 className="size-4 shrink-0" style={{ color: "var(--success)" }} />
                  ) : active ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" style={{ color: "var(--accent)" }} />
                  ) : (
                    <Circle className="size-4 shrink-0" style={{ color: "var(--border)" }} />
                  )}
                  <span
                    className="text-sm"
                    style={{
                      color: done ? "var(--ink-2)" : active ? "var(--ink)" : "var(--subtle)",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {s.label}
                    {s.key === "accepted" && active && (
                      <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--muted)" }}>
                        · provisional
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {!isFailed && !isTracking && stage !== "finalized" && (
          <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
            Validators are reaching consensus. This can take several minutes; keep this tab open.
          </p>
        )}

        {hash && (
          <div
            className="mt-3 flex items-center justify-between rounded-xl px-3 py-2"
            style={{ background: "rgba(18,45,69,0.05)" }}
          >
            <code className="mono text-xs truncate max-w-[180px]" style={{ color: "var(--ink-2)" }}>
              {hash}
            </code>
            <a
              href={`${EXPLORER_URL}/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: "var(--accent-hover)" }}
            >
              Explorer <ExternalLink className="size-3" />
            </a>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
