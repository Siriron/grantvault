import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WalletProvider } from "@/components/WalletProvider";
import { useWallet } from "@/hooks/useWallet";
import { HomeView } from "@/views/HomeView";
import { NewVaultView } from "@/views/NewVaultView";
import { VaultView } from "@/views/VaultView";
import { DocsView } from "@/views/DocsView";
import { GuideView } from "@/views/GuideView";
import { shortAddress } from "@/lib/format";
import { Package, LogOut, AlertCircle, BookOpen, FlaskConical } from "lucide-react";


type View =
  | { name: "home" }
  | { name: "new" }
  | { name: "docs" }
  | { name: "guide" }
  | { name: "vault"; id: string }
  | { name: "notfound" };

// Hash routing keeps every view deep-linkable on a static host with no server config.
function parseHash(hash: string): View {
  const path = hash.replace(/^#/, "").replace(/\/+$/, "") || "/";
  if (path === "/") return { name: "home" };
  if (path === "/new") return { name: "new" };
  if (path === "/docs") return { name: "docs" };
  if (path === "/guide") return { name: "guide" };
  const m = /^\/vault\/(\d+)$/.exec(path);
  if (m) return { name: "vault", id: m[1] };
  return { name: "notfound" };
}

function useRoute(): [View, (to: string) => void] {
  const [view, setView] = useState<View>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setView(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const go = useCallback((to: string) => {
    window.location.hash = to;
  }, []);
  return [view, go];
}

const spectral = "linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)";

function Header({ onHome, onDocs, onGuide }: { onHome: () => void; onDocs: () => void; onGuide: () => void }) {
  const { address, connected, disconnect, onStudionet } = useWallet();
  return (
    <header className="relative z-20 flex items-center justify-between px-4 py-4 max-w-md mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onHome} className="flex items-center gap-2" aria-label="GrantVault home">
          <div
            className="flex size-7 items-center justify-center rounded-xl"
            style={{ background: "var(--accent)" }}
          >
            <Package className="size-4 text-white" />
          </div>
          <span className="display text-base font-bold" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
            GrantVault
          </span>
        </button>
        <button
          onClick={onDocs}
          className="flex items-center gap-1 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: "var(--ink-2)" }}
        >
          <BookOpen className="size-3.5" /> Docs
        </button>
        <button
          onClick={onGuide}
          className="flex items-center gap-1 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: "var(--ink-2)" }}
        >
          <FlaskConical className="size-3.5" /> Test guide
        </button>
      </div>

      {connected && (
        <div className="flex items-center gap-2">
          {!onStudionet && (
            <div
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: "rgba(186,43,76,0.10)", color: "var(--danger)" }}
            >
              <AlertCircle className="size-3" />
              Wrong network
            </div>
          )}
          {onStudionet && (
            <div
              className="hidden sm:flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: "rgba(26,128,71,0.10)", color: "var(--success)" }}
            >
              Studionet
            </div>
          )}
          <div
            className="flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{
              background: "rgba(255,255,255,0.72)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.66)",
            }}
          >
            <div
              className="size-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "var(--accent)" }}
            >
              {address.slice(2, 4).toUpperCase()}
            </div>
            <code className="mono text-xs" style={{ color: "var(--ink-2)" }}>
              {shortAddress(address)}
            </code>
            <button
              onClick={disconnect}
              aria-label="Disconnect wallet"
              className="opacity-40 hover:opacity-80 transition-opacity"
            >
              <LogOut className="size-3.5" style={{ color: "var(--ink-2)" }} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function App() {
  const [view, go] = useRoute();

  return (
    <div
      className="relative min-h-dvh overflow-x-hidden"
      style={{ background: "linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)" }}
    >
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          style={{
            position: "absolute", top: "6%", left: "2%",
            width: 320, height: 320, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(133,177,237,0.20) 0%, transparent 70%)",
            filter: "blur(70px)",
          }}
        />
        <div
          style={{
            position: "absolute", top: "40%", right: "-5%",
            width: 280, height: 280, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(175,143,244,0.14) 0%, transparent 70%)",
            filter: "blur(65px)",
          }}
        />
        <div
          style={{
            position: "absolute", bottom: "6%", left: "10%",
            width: 260, height: 260, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,205,131,0.18) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      {/* Spectral top rule */}
      <div className="fixed top-0 left-0 right-0 h-0.5 z-30" style={{ background: spectral }} />

      <div className="relative z-10">
        <Header onHome={() => go("/")} onDocs={() => go("/docs")} onGuide={() => go("/guide")} />

        <main className="mx-auto max-w-md px-4 pb-16 pt-2">
          <AnimatePresence mode="wait">
            {view.name === "home" && (
              <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <HomeView
                  onNew={() => go("/new")}
                  onVault={(id) => go(`/vault/${id}`)}
                />
              </motion.div>
            )}
            {view.name === "new" && (
              <motion.div key="new" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <NewVaultView
                  onBack={() => go("/")}
                  onCreated={(id) => go(id ? `/vault/${id}` : "/")}
                />
              </motion.div>
            )}
            {view.name === "vault" && (
              <motion.div key={`vault-${view.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <VaultView
                  vaultId={view.id}
                  onBack={() => go("/")}
                />
              </motion.div>
            )}
            {view.name === "docs" && (
              <motion.div key="docs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <DocsView onBack={() => go("/")} />
              </motion.div>
            )}
            {view.name === "guide" && (
              <motion.div key="guide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <GuideView onBack={() => go("/")} go={go} />
              </motion.div>
            )}
            {view.name === "notfound" && (
              <motion.div key="notfound" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-16 text-center">
                <h2 className="display text-2xl font-bold mb-2" style={{ color: "var(--ink)" }}>Page not found</h2>
                <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>That address does not match any page in GrantVault.</p>
                <button
                  onClick={() => go("/")}
                  className="rounded-2xl px-6 py-2.5 text-sm font-semibold text-white"
                  style={{ background: "var(--accent)" }}
                >
                  Back to vaults
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function Root() {
  return (
    <WalletProvider>
      <App />
    </WalletProvider>
  );
}
