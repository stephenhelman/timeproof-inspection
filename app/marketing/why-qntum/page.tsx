import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Why Qntum",
  description:
    "Learn what makes Qntum Roofing different — Owens Corning Preferred status, the attic commitment, and why every homeowner gets a written Scope Report.",
  openGraph: {
    title: "Why Qntum Roofing | Scope Reports",
    description: "Owens Corning Preferred Contractor. Attic inspection on every job. Written report, every time.",
  },
};

const QNTUM_URL = process.env.NEXT_PUBLIC_QNTUM_WEBSITE_URL || "https://qntum.com";

const PRODUCTS = [
  {
    name: "TruDef Duration Shingles",
    desc: "Qntum's standard shingle is the TruDef Duration. It carries Owens Corning's SureNail Technology, which improves wind resistance and reduces blow-offs — a real concern in the El Paso wind corridor.",
  },
  {
    name: "DeckDefense Underlayment",
    desc: "A synthetic underlayment that creates a water-resistant barrier directly on the deck. It's more durable than felt, stays in place during installation, and improves the overall system performance.",
  },
  {
    name: "Titanium UDL Underlayment",
    desc: "Used in higher-slope and high-exposure zones. Titanium is a premium synthetic underlayment that adds another layer of weather protection where standard products are insufficient.",
  },
];

export default function WhyQntumPage() {
  return (
    <>
      {/* Hero */}
      <section className="px-5 pt-20 pb-16 max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6 text-text-primary">
          Why Qntum Roofing
        </h1>
        <p className="text-text-secondary text-lg leading-relaxed max-w-2xl mx-auto">
          There are a lot of roofing contractors in El Paso. Here&apos;s what makes this different.
        </p>
      </section>

      {/* Owens Corning */}
      <section className="px-5 py-16 bg-bg-surface">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center text-2xl">
              🏆
            </div>
            <div>
              <h2 className="text-text-primary font-bold text-xl mb-1">
                Owens Corning Preferred Contractor
              </h2>
              <p className="text-text-hint text-sm">Verified status — not self-reported</p>
            </div>
          </div>
          <div className="space-y-4 text-text-secondary text-sm leading-relaxed">
            <p>
              Owens Corning&apos;s Preferred Contractor program is not handed out freely. To qualify,
              a contractor must meet minimum installation standards, carry proper licensing and
              insurance, and maintain a track record of completed projects using OC products.
            </p>
            <p>
              What this means for you: when Qntum installs a new roof, the materials carry an Owens
              Corning system warranty — not just a product warranty. The full system is backed.
              That&apos;s only available through Preferred Contractors.
            </p>
            <p>
              It also means you&apos;re working with a company that can be held accountable to a
              manufacturer, not just to their own word.
            </p>
          </div>
        </div>
      </section>

      {/* The product difference */}
      <section className="px-5 py-16 max-w-5xl mx-auto">
        <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase text-center mb-10">
          What goes on your roof
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PRODUCTS.map(({ name, desc }) => (
            <div key={name} className="border border-border bg-bg-surface rounded-xl p-6">
              <h3 className="text-text-primary font-semibold text-base mb-3">{name}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-text-hint text-xs text-center mt-6">
          These aren&apos;t upgrades. They&apos;re the standard install on every Qntum job.
        </p>
      </section>

      {/* Attic commitment */}
      <section className="px-5 py-16 bg-bg-surface">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase text-center mb-10">
            The attic commitment
          </p>
          <div className="border border-accent-blue bg-bg-base rounded-2xl p-8">
            <h2 className="text-text-primary font-bold text-xl mb-4">
              We go in the attic. Every time.
            </h2>
            <div className="space-y-4 text-text-secondary text-sm leading-relaxed">
              <p>
                Most roofing contractors don&apos;t go in the attic during an inspection. It takes
                more time, it&apos;s uncomfortable, and the homeowner doesn&apos;t usually ask for
                it. So it gets skipped.
              </p>
              <p>
                The problem: the attic is where most roof failures actually start. Blocked soffits
                cause heat buildup. Moisture condenses on nail tips and creates rot. Amber deposits
                — sap that bleeds from rafters under sustained high heat — are a definitive sign
                that the ventilation system is failing. None of these are visible from the roof
                surface.
              </p>
              <p>
                We inspect the attic on every Scope Report because the surface inspection alone
                doesn&apos;t tell the full story. If we only looked at the shingles, we&apos;d miss
                half the findings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Report commitment */}
      <section className="px-5 py-16 max-w-3xl mx-auto">
        <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase text-center mb-10">
          The report commitment
        </p>
        <h2 className="text-text-primary font-bold text-xl mb-6 text-center">
          Every homeowner gets a written Scope Report.
        </h2>
        <div className="space-y-4 text-text-secondary text-sm leading-relaxed">
          <p>
            Not a verbal rundown at the kitchen table. Not a handshake and a &quot;trust us.&quot;
            A documented report with real photos from your actual roof — organized by finding,
            labeled plainly, and sent to you the same day.
          </p>
          <p>
            You can share it with your spouse, your insurance company, or a second contractor you
            want a quote from. It&apos;s yours. It has no expiration date.
          </p>
          <p>
            This is how we hold ourselves accountable. If we say we found something, it&apos;s in
            the report. If the report says it&apos;s there, we photographed it. No vague claims,
            no pressure tactics, no manufactured urgency.
          </p>
        </div>
      </section>

      {/* Qntum link */}
      <section className="px-5 py-10 bg-bg-surface">
        <div className="max-w-3xl mx-auto border border-border rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-text-primary font-semibold text-base mb-1">Powered by Qntum Roofing</p>
            <p className="text-text-secondary text-sm">
              Scope Reports is the inspection and documentation tool built by Qntum Roofing for
              every job they run.
            </p>
          </div>
          <a
            href={QNTUM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-sm font-semibold text-accent-blue hover:text-accent-blue-hover transition-colors"
          >
            Visit Qntum Roofing ↗
          </a>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-16 text-center">
        <a
          href="/#check-area"
          className="inline-block bg-accent-blue hover:bg-accent-blue-hover text-white font-bold text-base px-8 py-4 rounded-lg transition-colors"
        >
          See If We&apos;re In Your Area →
        </a>
      </section>
    </>
  );
}
