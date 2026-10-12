import { CHAIN_ID, EXPLORER_URL, RPC_URL } from "@/config/chains";

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export function injected(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { ethereum?: EthereumProvider };
  return w.ethereum ?? null;
}

const CHAIN_HEX = `0x${CHAIN_ID.toString(16)}`;

function errorCode(err: unknown): number | undefined {
  return typeof err === "object" && err !== null && "code" in err
    ? Number(err.code)
    : undefined;
}

/** Put the wallet on GenLayer Studionet. Call immediately before every write. */
export async function ensureStudionet(provider: EthereumProvider): Promise<void> {
  const chainId = await provider.request({ method: "eth_chainId" });
  if (parseInt(String(chainId), 16) === CHAIN_ID) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch (err) {
    const code = errorCode(err);
    if (code === 4902) {
      // Chain unknown to the wallet: add it, then switch.
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN_HEX,
            chainName: "GenLayer Studionet",
            nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: [EXPLORER_URL],
          },
        ],
      });
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
    } else if (code === -32002) {
      // A wallet request is already pending; give the user a moment to answer it.
      await new Promise((r) => setTimeout(r, 3000));
    } else {
      throw err; // includes 4001 (user rejected): surface it instead of masking it
    }
  }
}
