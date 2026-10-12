import { Package, Calendar, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import type { Vault } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { formatReward, formatDeadline, shortAddress, bumpLabel } from "@/lib/format";

const glass = {
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.68)",
  boxShadow: "0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)",
} as React.CSSProperties;

const spectral = "linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)";

export function VaultCard({
  vault,
  onClick,
  highlight,
}: {
  vault: Vault;
  onClick?: () => void;
  highlight?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 16px 48px rgba(18,45,69,0.12)" }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="relative rounded-2xl overflow-hidden cursor-pointer"
      style={{ ...glass, border: highlight ? "none" : glass.border }}
      onClick={onClick}
    >
      {highlight && (
        <div className="absolute inset-0 rounded-2xl p-px" style={{ background: spectral, zIndex: 0 }}>
          <div className="h-full w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.96)" }} />
        </div>
      )}
      <div className="relative z-10 p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "rgba(18,45,69,0.07)" }}
            >
              <Package className="size-4" style={{ color: "var(--ink)" }} />
            </div>
            <div className="min-w-0">
              <p
                className="display font-bold text-sm truncate"
                style={{ color: "var(--ink)", letterSpacing: "-0.01em" }}
              >
                {vault.package}
              </p>
              <p className="text-xs truncate" style={{ color: "var(--muted)" }}>
                by {vault.publisher_name}
              </p>
            </div>
          </div>
          <StatusBadge status={vault.status} />
        </div>

        <p
          className="text-xs mb-3 line-clamp-2"
          style={{ color: "var(--ink-2)", lineHeight: 1.55 }}
        >
          {vault.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="display text-lg font-bold tabular-nums"
              style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}
            >
              {formatReward(vault.reward)}
            </span>
            <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              GEN · min {bumpLabel(vault.min_bump)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--subtle)" }}>
            <Calendar className="size-3" />
            <span>{formatDeadline(vault.deadline)}</span>
          </div>
        </div>

        <div
          className="mt-3 pt-3 flex items-center justify-between"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <span className="text-xs" style={{ color: "var(--subtle)" }}>
            Funder {shortAddress(vault.funder)}
          </span>
          <ArrowRight className="size-3.5" style={{ color: "var(--subtle)" }} />
        </div>
      </div>
    </motion.div>
  );
}
