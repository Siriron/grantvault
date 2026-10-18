// Guided test support: scenarios, pre-filled form values, the current test run and a transaction log.
// Everything here lives in this browser only (localStorage); nothing is sent anywhere.
// Test vaults are found on-chain by a tag inside their description ("gv-<run>-<scenario>"), so step status
// always comes from the contract, not from this file.
import { EXPLORER_URL } from "@/config/chains";
import type { MinBump, Vault } from "./types";

export type ScenarioKey = "A" | "B" | "C" | "D" | "E";

export interface Scenario {
  key: ScenarioKey;
  label: string;
  summary: string;
  expected: string;
  needsOwnPackage: boolean;
}

// is-odd / jonschlinkert / 3.0.1 is a real, old npm release (published 2018) that always exists, so scenarios
// A to C need no npm publishing from the tester.
export const DEMO_PACKAGE = "is-odd";
export const DEMO_PUBLISHER = "jonschlinkert";
export const DEMO_OLD_VERSION = "3.0.1";
export const DEMO_MISSING_VERSION = "99.0.0";

export const SCENARIOS: Scenario[] = [
  {
    key: "A",
    label: "A. Old release is rejected (NOT_GRANTED)",
    summary:
      "A real release that already existed before the maintainer accepted the grant must never qualify. Uses the real npm package is-odd, version 3.0.1 (published in 2018).",
    expected: "NOT_GRANTED, reason: published before the maintainer accepted the grant. Vault stays ACTIVE.",
    needsOwnPackage: false,
  },
  {
    key: "B",
    label: "B. Wrong npm publisher is rejected (NOT_GRANTED)",
    summary:
      "The vault expects a different npm account than the one that really published is-odd 3.0.1.",
    expected: "NOT_GRANTED, reason: published by a different account than expected.",
    needsOwnPackage: false,
  },
  {
    key: "C",
    label: "C. Version not in the registry (INCONCLUSIVE)",
    summary: "Submitting a version that does not exist on npm yet (99.0.0). No funds move and the maintainer can retry.",
    expected: "INCONCLUSIVE, reason: version not in the registry yet. Vault stays ACTIVE.",
    needsOwnPackage: false,
  },
  {
    key: "D",
    label: "D. Granted release and payout (your own npm package)",
    summary:
      "The full happy path. You publish a new release of your own npm package AFTER the maintainer accepts, submit it, claim the payout and confirm delivery.",
    expected:
      "GRANTED (or INCONCLUSIVE if the registry facts cannot show what the description promises), then payout dispatched and settled.",
    needsOwnPackage: true,
  },
  {
    key: "E",
    label: "E. Cancel and refund",
    summary: "The funder cancels an unaccepted vault, claims the refund and confirms delivery.",
    expected: "CANCELLED, then refund dispatched and REFUND_SETTLED.",
    needsOwnPackage: false,
  },
];

// ---- current run ------------------------------------------------------------------------------

export interface Run {
  suffix: string;
  scenario: ScenarioKey;
  maintainer: string; // the second wallet
  pkg: string; // scenario D only
  npmUser: string; // scenario D only
  version: string; // scenario D only
  bump: MinBump; // scenario D only
}

const RUN_KEY = "gv.run";
const LOG_KEY = "gv.txlog";
const PREFILL_KEY = "gv.prefill";

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the guide still works for this page view */
  }
}

export function getRun(): Run | null {
  return load<Run>(RUN_KEY);
}

export function saveRun(run: Run) {
  save(RUN_KEY, run);
}

export function newRun(prev: Run | null): Run {
  const run: Run = {
    suffix: Date.now().toString(36),
    scenario: prev?.scenario ?? "A",
    maintainer: prev?.maintainer ?? "",
    pkg: prev?.pkg ?? "",
    npmUser: prev?.npmUser ?? "",
    version: prev?.version ?? "",
    bump: prev?.bump ?? "patch",
  };
  save(RUN_KEY, run);
  return run;
}

export function resumeRun(suffix: string, prev: Run | null): Run | null {
  const clean = suffix.trim().toLowerCase();
  if (!/^[a-z0-9]{4,16}$/.test(clean)) return null;
  const run: Run = { ...(prev ?? newRun(null)), suffix: clean };
  save(RUN_KEY, run);
  return run;
}

export function clearRun() {
  try {
    localStorage.removeItem(RUN_KEY);
    localStorage.removeItem(LOG_KEY);
    localStorage.removeItem(PREFILL_KEY);
  } catch {
    /* ignore */
  }
}

export const tagFor = (suffix: string, key: ScenarioKey) => `gv-${suffix}-${key}`;
const TAG_RE = /gv-([a-z0-9]+)-([A-E])/;

export function parseTag(description: string): { suffix: string; key: ScenarioKey } | null {
  const m = TAG_RE.exec(description);
  return m ? { suffix: m[1], key: m[2] as ScenarioKey } : null;
}

// ---- pre-filled values ------------------------------------------------------------------------

export interface Prefill {
  pkg: string;
  maintainer: string;
  pubName: string;
  minBump: MinBump;
  deadlineDays: string;
  rewardGen: string;
  description: string;
}

export function prefillFor(run: Run, key: ScenarioKey): Prefill {
  const tag = `[${tagFor(run.suffix, key)}]`;
  const base = {
    maintainer: run.maintainer,
    minBump: "patch" as MinBump,
    deadlineDays: "7",
    rewardGen: "0.01",
  };
  switch (key) {
    case "A":
      return {
        ...base,
        pkg: DEMO_PACKAGE,
        pubName: DEMO_PUBLISHER,
        description: `${tag} Ship a patch release of ${DEMO_PACKAGE}. Test: ${DEMO_OLD_VERSION} existed before this grant was accepted.`,
      };
    case "B":
      return {
        ...base,
        pkg: DEMO_PACKAGE,
        pubName: "not-the-publisher",
        description: `${tag} Ship a patch release of ${DEMO_PACKAGE}. Test: the expected npm publisher is wrong on purpose.`,
      };
    case "C":
      return {
        ...base,
        pkg: DEMO_PACKAGE,
        pubName: DEMO_PUBLISHER,
        description: `${tag} Ship a patch release of ${DEMO_PACKAGE}. Test: ${DEMO_MISSING_VERSION} is not on npm.`,
      };
    case "D":
      return {
        ...base,
        pkg: run.pkg,
        pubName: run.npmUser,
        minBump: run.bump,
        deadlineDays: "14",
        description: `${tag} Publish the next ${run.bump} release of ${run.pkg} after this grant is accepted. Keep a real test script and update the dependencies.`,
      };
    default:
      return {
        ...base,
        pkg: DEMO_PACKAGE,
        pubName: DEMO_PUBLISHER,
        description: `${tag} Cancel and refund check for ${DEMO_PACKAGE}. The funder cancels before acceptance.`,
      };
  }
}

export function setPrefill(p: Prefill) {
  save(PREFILL_KEY, p);
}

export function readPrefill(): Prefill | null {
  return load<Prefill>(PREFILL_KEY);
}

export function clearPrefill() {
  try {
    localStorage.removeItem(PREFILL_KEY);
  } catch {
    /* ignore */
  }
}

// Version to pre-fill on the evaluate form of a tagged test vault.
export function suggestedVersion(v: Vault): string {
  const tag = parseTag(v.description);
  if (!tag) return "";
  if (tag.key === "A" || tag.key === "B") return DEMO_OLD_VERSION;
  if (tag.key === "C") return DEMO_MISSING_VERSION;
  if (tag.key === "D") {
    const run = getRun();
    return run && run.suffix === tag.suffix ? run.version : "";
  }
  return "";
}

// ---- transaction log --------------------------------------------------------------------------

export type LogStatus = "ACCEPTED" | "FINALIZED" | "FAILED";
export interface LoggedTx {
  label: string;
  hash: string;
  status: LogStatus;
  execution: string;
  at: number;
}

export function readTxLog(): LoggedTx[] {
  return load<LoggedTx[]>(LOG_KEY) ?? [];
}

const RANK: Record<LogStatus, number> = { ACCEPTED: 1, FINALIZED: 2, FAILED: 3 };

export function recordTx(label: string, hash: string, status: LogStatus, execution = "") {
  const log = readTxLog();
  const existing = log.find((t) => t.hash === hash);
  if (existing) {
    if (RANK[status] > RANK[existing.status]) existing.status = status;
    if (execution) existing.execution = execution;
  } else {
    log.push({ label, hash, status, execution, at: Math.floor(Date.now() / 1000) });
  }
  save(LOG_KEY, log);
}

export function txLogText(log: LoggedTx[]): string {
  return log
    .map(
      (t) =>
        `${t.label} | ${t.status}${t.execution ? ` (${t.execution})` : ""} | ${t.hash} | ${EXPLORER_URL}/tx/${t.hash}`
    )
    .join("\n");
}
