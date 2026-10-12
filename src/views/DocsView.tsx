import { ArrowLeft } from "lucide-react";
import { CHAIN_ID, CONTRACT_ADDRESS, EXPLORER_URL, RPC_URL, isConfigured } from "@/config/chains";

const glass = {
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.68)",
  boxShadow: "0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)",
} as React.CSSProperties;

const methods: Array<[string, string, string]> = [
  ["create_vault(maintainer, package, publisher_name, min_bump, deadline, description)", "Funder, payable", "Locks the attached GEN and the grant terms. Terms cannot change afterwards."],
  ["accept_grant(vault_id)", "Maintainer", "Accepts the terms; the funder can no longer cancel."],
  ["cancel_vault(vault_id)", "Funder", "Cancels a vault the maintainer has not accepted; makes the reward refundable."],
  ["evaluate_release(vault_id, version)", "Maintainer", "Validators fetch the npm registry and reach consensus on GRANTED, NOT_GRANTED or INCONCLUSIVE."],
  ["close_expired(vault_id)", "Anyone", "After the deadline, expires an OPEN or ACTIVE vault and makes the reward refundable."],
  ["claim_funds(vault_id)", "Maintainer or funder", "One-shot payout (GRANTED) or refund (cancelled/expired). Balance is zeroed before the transfer."],
  ["get_vault, get_attempts, get_for_wallet, get_claimable", "Read-only", "JSON-string views used by this app."],
];

const faqs: Array<[string, string]> = [
  ["What does INCONCLUSIVE mean?", "Reliable registry evidence could not be obtained (registry down, record incomplete, bump undeterminable). No funds move and the same version can be submitted again."],
  ["What happens after NOT_GRANTED?", "That version is sealed for this vault. The vault stays active, so the maintainer can submit a different version before the deadline."],
  ["Who decides the outcome?", "Nobody. There is no administrator or off-chain operator; GenLayer validators independently re-derive the verdict and must agree."],
  ["Can the funder take the money back after acceptance?", "No. After acceptance the funder can only reclaim the reward once the vault expires without a granted release."],
  ["Which packages are supported?", "Public npm packages. The registry URL is built by the contract from the locked package name and the submitted version; callers cannot supply a URL."],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-4" style={glass}>
      <h2 className="display text-base font-bold mb-2" style={{ color: "var(--ink)" }}>{title}</h2>
      <div className="text-sm space-y-2" style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>{children}</div>
    </section>
  );
}

export function DocsView({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity" style={{ color: "var(--muted)" }}>
        <ArrowLeft className="size-4" /> Back
      </button>
      <h1 className="display text-2xl font-bold" style={{ color: "var(--ink)", letterSpacing: "-0.03em" }}>Documentation</h1>

      <Section title="Overview">
        <p>A funder locks GEN for a designated maintainer who promised to publish an npm release by a deadline. When the maintainer submits a version, GenLayer validators fetch the public npm registry themselves and decide by consensus whether the grant condition is met.</p>
      </Section>

      <Section title="How it works">
        <ol className="list-decimal pl-5 space-y-1">
          <li>The funder creates a vault: package, maintainer wallet, expected npm publisher, minimum semver bump, deadline, description and the GEN reward.</li>
          <li>The maintainer accepts the terms.</li>
          <li>The maintainer submits a version. Validators check the registry record, publisher, publish time against the deadline and the semver bump, then make a qualitative judgement of the description.</li>
          <li>GRANTED makes the reward claimable by the maintainer. Otherwise the vault stays active until the deadline, after which anyone can expire it and the funder reclaims the reward.</li>
        </ol>
      </Section>

      <Section title="Architecture">
        <p>React + Vite frontend, <code className="mono">genlayer-js</code> reads and writes, one GenLayer intelligent contract on Studionet. There is no application backend, database or operator key.</p>
      </Section>

      <Section title="Smart contract">
        {isConfigured() ? (
          <p>
            Contract:{" "}
            <a className="mono underline" href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">{CONTRACT_ADDRESS}</a>
          </p>
        ) : (
          <p>The contract address has not been configured in this build.</p>
        )}
        <p>Network: GenLayer Studionet (chain id {CHAIN_ID}). RPC <code className="mono">{RPC_URL}</code>.</p>
      </Section>

      <Section title="API reference">
        <ul className="space-y-3">
          {methods.map(([sig, who, what]) => (
            <li key={sig}>
              <code className="mono text-xs break-words" style={{ color: "var(--ink)" }}>{sig}</code>
              <p className="text-xs" style={{ color: "var(--muted)" }}>{who}. {what}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="FAQ">
        <dl className="space-y-3">
          {faqs.map(([q, a]) => (
            <div key={q}>
              <dt className="font-semibold" style={{ color: "var(--ink)" }}>{q}</dt>
              <dd>{a}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}
