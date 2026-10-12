import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CHAIN_ID } from "@/config/chains";
import { ensureStudionet, injected, type EthereumProvider } from "@/lib/wallet";

type WalletCtx = {
  address: string;
  chainId: number | null;
  connected: boolean;
  onStudionet: boolean;
  provider: EthereumProvider | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
};

export const WalletContext = createContext<WalletCtx | null>(null);

export function useWallet(): WalletCtx {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("WalletProvider missing");
  return ctx;
}

export function useWalletState() {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<EthereumProvider | null>(() => injected());

  const sync = useCallback(async () => {
    const p = injected();
    setProvider(p);
    if (!p) return;
    const accounts = (await p.request({ method: "eth_accounts" })) as string[];
    const chain = (await p.request({ method: "eth_chainId" })) as string;
    setAddress(accounts[0] ?? "");
    setChainId(parseInt(chain, 16));
  }, []);

  useEffect(() => {
    const init = async () => { await sync(); };
    void init();
    const p = injected();
    if (!p?.on) return;
    const cb = () => { void sync(); };
    p.on("accountsChanged", cb);
    p.on("chainChanged", cb);
    return () => {
      p.removeListener?.("accountsChanged", cb);
      p.removeListener?.("chainChanged", cb);
    };
  }, [sync]);

  const connect = useCallback(async () => {
    const p = injected();
    if (!p) throw new Error("No injected EVM wallet found. Install MetaMask or Rabby.");
    await p.request({ method: "eth_requestAccounts" });
    await sync();
  }, [sync]);

  const disconnect = useCallback(() => setAddress(""), []);

  const switchNetwork = useCallback(async () => {
    const p = injected();
    if (!p) throw new Error("No injected wallet");
    await ensureStudionet(p);
    await sync();
  }, [sync]);

  return useMemo(
    () => ({
      address,
      chainId,
      connected: Boolean(address),
      onStudionet: chainId === CHAIN_ID,
      provider,
      connect,
      disconnect,
      switchNetwork,
    }),
    [address, chainId, provider, connect, disconnect, switchNetwork]
  );
}
