import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, ExecutionResult, TransactionHashVariant } from "genlayer-js/types";
import type { EIP1193Provider } from "viem";
import { CONTRACT_ADDRESS, EXPLORER_URL, isConfigured } from "@/config/chains";
import type { Settlement, Vault, VaultAttempt } from "./types";

const readClient = createClient({ chain: studionet });

// The contract's views return JSON strings (never raw objects); decode them here.
function decode<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  if (value instanceof Map) return decode<T>(Object.fromEntries(value as Map<string, unknown>));
  return value as T;
}

async function read<T>(name: string, args: unknown[] = []): Promise<T> {
  if (!isConfigured()) throw new Error("Contract address not configured");
  return decode<T>(
    await readClient.readContract({
      address: CONTRACT_ADDRESS,
      functionName: name,
      args: args as never,
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    })
  );
}

export const api = {
  vault: (id: string) => read<Vault>("get_vault", [id]),
  attempts: (id: string) => read<VaultAttempt[]>("get_attempts", [id]),
  forWallet: (address: string) => read<Vault[]>("get_for_wallet", [address]),
  settlement: () => read<Settlement>("get_settlement"),
  claimable: async (address: string) =>
    (await read<{ claimable: string }>("get_claimable", [address])).claimable,
};

export type WriteProgress = {
  hash: string;
  status: "SUBMITTED" | "ACCEPTED" | "FINALIZED" | "TRACKING" | "UNKNOWN" | "FAILED";
  execution?: string;
  error?: string;
};

type Receipt = {
  statusName?: string;
  status_name?: string;
  txExecutionResultName?: string;
  tx_execution_result_name?: string;
  execution_result?: string;
  result_name?: string;
  consensus_data?: { leader_receipt?: Array<{ execution_result?: string }> };
  value_credited?: boolean;
};

export class SubmittedTransactionError extends Error {
  constructor(
    public readonly hash: string,
    message: string,
    public readonly status: WriteProgress["status"] = "TRACKING"
  ) {
    super(message);
    this.name = "SubmittedTransactionError";
  }
}

export class ExecutionFailedError extends Error {
  constructor(
    public readonly hash: string,
    public readonly execution: string,
    message: string
  ) {
    super(message);
    this.name = "ExecutionFailedError";
  }
}

function receiptStatus(r: Receipt) {
  return String(r.statusName || r.status_name || "").toUpperCase();
}

function receiptExecution(r: Receipt) {
  const direct = r.txExecutionResultName || r.tx_execution_result_name || r.execution_result;
  if (direct) return String(direct).toUpperCase();
  const leader = r.consensus_data?.leader_receipt?.find((x) => x.execution_result);
  return String(leader?.execution_result || "").toUpperCase();
}

export function executionSucceeded(r: Receipt) {
  return [ExecutionResult.FINISHED_WITH_RETURN, "SUCCESS"].includes(
    receiptExecution(r)
  );
}

export function executionFailed(r: Receipt) {
  return [ExecutionResult.FINISHED_WITH_ERROR, "ERROR"].includes(
    receiptExecution(r)
  );
}

function finalOutcome(
  hash: string,
  receipt: Receipt,
  onProgress?: (p: WriteProgress) => void
) {
  if (executionFailed(receipt)) {
    const execution = receiptExecution(receipt);
    onProgress?.({ hash, status: "FAILED", execution, error: "GenVM execution failed." });
    throw new ExecutionFailedError(
      hash,
      execution || "FINISHED_WITH_ERROR",
      "Transaction finalized with a contract execution error."
    );
  }
  if (!executionSucceeded(receipt)) {
    const execution = receiptExecution(receipt);
    onProgress?.({
      hash,
      status: "UNKNOWN",
      execution,
      error: "Finality reached but execution success was not proven.",
    });
    throw new ExecutionFailedError(
      hash,
      execution || "NOT_VOTED",
      "Finality reached but GenVM execution success was not proven."
    );
  }
  const execution = receiptExecution(receipt);
  onProgress?.({ hash, status: "FINALIZED", execution });
  return { hash, status: "FINALIZED" as const, execution, explorer: `${EXPLORER_URL}/tx/${hash}` };
}

async function waitForFinalization(
  client: ReturnType<typeof createClient>,
  hash: string,
  onProgress?: (p: WriteProgress) => void
) {
  try {
    const receipt = (await client.waitForTransactionReceipt({
      hash: hash as never,
      status: TransactionStatus.FINALIZED,
      retries: 450,
      interval: 4000,
    })) as unknown as Receipt;
    return finalOutcome(hash, receipt, onProgress);
  } catch (err) {
    if (err instanceof ExecutionFailedError) throw err;
    onProgress?.({
      hash,
      status: "TRACKING",
      error: err instanceof Error ? err.message : String(err),
    });
    throw new SubmittedTransactionError(
      hash,
      "Transaction submitted but finality not confirmed yet."
    );
  }
}

export async function write(
  address: `0x${string}`,
  provider: EIP1193Provider,
  name: string,
  args: unknown[],
  value = 0n,
  onProgress?: (p: WriteProgress) => void
) {
  if (!isConfigured()) throw new Error("Contract address not configured");
  // account is the plain wallet address (never createAccount(address): that expects a private key).
  const client = createClient({ chain: studionet, account: address, provider });
  const connect = (client as unknown as { connect?: (network: string) => Promise<void> }).connect;
  if (typeof connect === "function") await connect.call(client, "studionet");
  const hash = String(
    await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: name,
      args: args as never,
      value,
    })
  );
  onProgress?.({ hash, status: "SUBMITTED" });
  let accepted: Receipt;
  try {
    accepted = await client.waitForTransactionReceipt({
      hash: hash as never,
      status: TransactionStatus.ACCEPTED,
      retries: 180,
      interval: 4000,
    });
  } catch (err) {
    onProgress?.({
      hash,
      status: "TRACKING",
      error: err instanceof Error ? err.message : String(err),
    });
    throw new SubmittedTransactionError(
      hash,
      "Transaction submitted but accepted state not confirmed yet."
    );
  }
  if (receiptStatus(accepted) === String(TransactionStatus.ACCEPTED)) {
    const execution = receiptExecution(accepted);
    onProgress?.({ hash, status: "ACCEPTED", execution });
    if (executionFailed(accepted))
      throw new ExecutionFailedError(
        hash,
        execution || "FINISHED_WITH_ERROR",
        "Transaction accepted with a contract execution error."
      );
  } else {
    onProgress?.({
      hash,
      status: "UNKNOWN",
      execution: receiptExecution(accepted),
      error: `GenLayer status: ${receiptStatus(accepted) || "unknown"}`,
    });
  }
  return waitForFinalization(client, hash, onProgress);
}
