const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  OPEN:             { label: "Open",        color: "#1a8047", bg: "rgba(26,128,71,0.10)" },
  ACTIVE:           { label: "Active",      color: "#1061a6", bg: "rgba(16,97,166,0.10)" },
  PAYABLE:          { label: "Payable",     color: "#7c4a00", bg: "rgba(255,165,0,0.12)" },
  CANCELLED:        { label: "Cancelled",   color: "#6b6580", bg: "rgba(107,101,128,0.10)" },
  EXPIRED:          { label: "Expired",     color: "#6b6580", bg: "rgba(107,101,128,0.10)" },
  GRANTED:          { label: "Granted",     color: "#1a8047", bg: "rgba(26,128,71,0.10)" },
  NOT_GRANTED:      { label: "Not Granted", color: "#ba2b4c", bg: "rgba(186,43,76,0.10)" },
  INCONCLUSIVE:     { label: "Inconclusive",color: "#7c4a00", bg: "rgba(255,165,0,0.12)" },
  PAYOUT_DISPATCHED:{ label: "Paid Out",    color: "#1a8047", bg: "rgba(26,128,71,0.10)" },
  REFUND_DISPATCHED:{ label: "Refunded",    color: "#6b6580", bg: "rgba(107,101,128,0.10)" },
};

const fallback = { label: "", color: "#6b6580", bg: "rgba(107,101,128,0.10)" };

export function StatusBadge({ status }: { status: string }) {
  const key = String(status);
  const s = Object.prototype.hasOwnProperty.call(statusMap, key)
    ? statusMap[key]
    : { ...fallback, label: key };
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide"
      style={{ color: s.color, background: s.bg, letterSpacing: "0.05em" }}
    >
      {s.label}
    </span>
  );
}
