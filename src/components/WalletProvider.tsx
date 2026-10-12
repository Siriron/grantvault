import { WalletContext, useWalletState } from "@/hooks/useWallet";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const state = useWalletState();
  return <WalletContext.Provider value={state}>{children}</WalletContext.Provider>;
}
