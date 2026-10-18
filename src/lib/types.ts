export type VaultStatus = string;
export type SettlementState = string;
export type AttemptOutcome = string;
export type MinBump = "patch" | "minor" | "major";

export type Vault = {
  id: string;
  funder: string;
  maintainer: string;
  package: string;
  publisher_name: string;
  min_bump: MinBump;
  target_version: string;
  deadline: number;
  reward: string;
  description: string;
  status: VaultStatus;
  accepted_at: number;
  submitted_version: string;
  created_at: number;
  closed_at: number;
  outcome: string;
  explanation: string;
  attempt_count: number;
  settlement_state: SettlementState;
  refund_dispatched: boolean;
  dispatched_amount: string;
  dispatched_at: number;
  recoveries: number;
};

export type Settlement = {
  balance: string;
  liability: string;
  in_flight: string;
};

export type VaultAttempt = {
  version: string;
  outcome: AttemptOutcome;
  explanation: string;
  at: number;
  publisher_found: string;
  published_at: string;
  source_digest: string;
  decision_digest: string;
  evidence: string;
};

export type TxStage =
  | "idle"
  | "wallet"
  | "submitted"
  | "accepted"
  | "finalized"
  | "tracking"
  | "unknown"
  | "failed";
