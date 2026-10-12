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
