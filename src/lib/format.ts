export function formatReward(raw: string): string {
  const n = Number(BigInt(raw || "0")) / 1e18;
  if (n === 0) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1) return n.toFixed(2).replace(/\.?0+$/, "");
  return n.toFixed(6).replace(/\.?0+$/, "");
}

export function formatDeadline(epoch: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = epoch - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400);
  if (days >= 1) return `${days}d left`;
  const hours = Math.floor(diff / 3600);
  if (hours >= 1) return `${hours}h left`;
  const mins = Math.floor(diff / 60);
  return `${mins}m left`;
}

export function isPast(epoch: number): boolean {
  return epoch <= Math.floor(Date.now() / 1000);
}

export function formatDate(epoch: number): string {
  if (!epoch) return "—";
  return new Date(epoch * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function bumpLabel(bump: string): string {
  const map: Record<string, string> = { patch: "patch", minor: "minor", major: "major" };
  return map[bump] ?? bump;
}

export function genFromWei(wei: string): number {
  return Number(BigInt(wei || "0")) / 1e18;
}

const GEN_DECIMAL = /^\d+(\.\d{1,18})?$/;

/** True for a positive decimal GEN amount with at most 18 fractional digits. */
export function isValidGen(gen: string): boolean {
  return GEN_DECIMAL.test(gen) && /[1-9]/.test(gen.replace(".", ""));
}

export function weiFromGen(gen: string): bigint {
  if (!GEN_DECIMAL.test(gen)) throw new Error("Invalid GEN amount");
  const [whole, frac = ""] = gen.split(".");
  return BigInt(whole) * 10n ** 18n + BigInt(frac.padEnd(18, "0"));
}

// Readable text for any thrown value. Wallet and RPC errors are often plain objects, not Error instances,
// which used to render as "[object Object]".
export function errorMessage(e: unknown, fallback = "Unknown error"): string {
  const seen = new Set<unknown>();
  const pick = (v: unknown, depth: number): string => {
    if (v == null || depth > 4 || seen.has(v)) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return v.toString();
    if (typeof v !== "object") return "";
    seen.add(v);
    const o = v as Record<string, unknown>;
    for (const k of ["shortMessage", "details", "reason", "message"]) {
      const s = o[k];
      if (typeof s === "string" && s.trim()) return s;
    }
    for (const k of ["error", "data", "cause", "info"]) {
      const s = pick(o[k], depth + 1);
      if (s) return s;
    }
    try {
      const j = JSON.stringify(v);
      return j && j !== "{}" ? j.slice(0, 400) : "";
    } catch {
      return "";
    }
  };
  const msg = pick(e, 0).trim() || fallback;
  const code = e && typeof e === "object" ? (e as { code?: unknown }).code : undefined;
  const low = msg.toLowerCase();
  if (code === 4001 || low.includes("user rejected") || low.includes("user denied")) {
    return "You rejected the request in the wallet.";
  }
  if (low.includes("insufficient funds") || low.includes("insufficient balance")) {
    return `Wallet balance is too low for the reward plus fees. (${msg})`;
  }
  return msg;
}
