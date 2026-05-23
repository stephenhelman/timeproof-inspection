import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "The story behind Scope Reports and Qntum Roofing — why we built a documentation tool for every inspection and why the attic matters.",
  openGraph: {
    title: "About Scope Reports | Qntum Roofing",
    description: "We built this because homeowners deserve better. A professional inspection with a written report shouldn't be rare.",
  },
};

const QNTUM_URL = process.env.NEXT_PUBLIC_QNTUM_WEBSITE_URL || "https://qntumroofing.com";

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="px-5 pt-20 pb-16 max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6 text-text-primary">
          We Built This Because Homeowners Deserve Better
        </h1>
        <p className="text-text-secondary text-lg leading-relaxed max-w-2xl mx-auto">
          A professional inspection with a written report shouldn&apos;t be rare. We made it
          standard.
        </p>
      </section>

      {/* The story */}
      <section className="px-5 py-16 bg-bg-surface">
        <div className="max-w-3xl mx-auto space-y-6 text-text-secondary text-base leading-relaxed">
          <p>
            We&apos;ve seen what happens when a homeowner gets bad information. Or no information.
            They make a $20,000 decision based on a verbal description at a kitchen table, with no
            photos, no documentation, and no way to verify what they were told.
          </p>
          <p>
            That&apos;s the standard in this industry. A contractor comes out, walks the roof
            (maybe), tells you what they think they saw, and asks you to sign. You either trust
            them or you don&apos;t. There&apos;s no evidence either way.
          </p>
          <p>
            We started doing inspections differently. We go on the roof. We go in the attic. We
            photograph everything we find — not to build a case, but to show you what&apos;s
            actually there. We walk through every photo with you and explain what it means in plain
            English. And then we give you a written report you can keep.
          </p>
          <p>
            The attic piece was the biggest shift. Most contractors skip it — it takes more time,
            it&apos;s uncomfortable, and most homeowners don&apos;t ask for it. But the attic is
            where most failures start. Blocked soffits, moisture on nail tips, amber deposits from
            heat buildup — none of this is visible from the roof surface. If we don&apos;t go up
            there, we&apos;re only telling you half the story.
          </p>
          <p>
            We built Scope Reports — the documentation tool — because the verbal rundown wasn&apos;t
            good enough. If we found something, we wanted it written down. If we said it was fine,
            we wanted that documented too. A report you can share with your insurance company, your
            family, or a second contractor. No expiration date. No login required. Just a record of
            what we found.
          </p>
        </div>
      </section>

      {/* Team */}
      <section className="px-5 py-16 max-w-5xl mx-auto">
        <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase text-center mb-10">
          The team
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder cards */}
          {[
            { name: "Inspection Specialist", area: "El Paso", role: "Field Inspector" },
            { name: "Inspection Specialist", area: "Las Cruces", role: "Field Inspector" },
            { name: "Setter Manager", area: "El Paso", role: "Scheduling & Intake" },
          ].map((member, i) => (
            <div
              key={i}
              className="border border-border bg-bg-surface rounded-xl p-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-bg-elevated border border-border mx-auto mb-4 flex items-center justify-center text-2xl">
                👤
              </div>
              <p className="text-text-primary font-semibold text-base">{member.name}</p>
              <p className="text-text-hint text-xs mt-0.5">{member.role}</p>
              <p className="text-text-hint text-xs mt-0.5">{member.area}</p>
            </div>
          ))}
        </div>
        <p className="text-text-hint text-xs text-center mt-6">
          Team photos coming soon.
        </p>
      </section>

      {/* The Scope Reports tool */}
      <section className="px-5 py-16 bg-bg-surface">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.25em] text-text-hint uppercase text-center mb-8">
            The tool
          </p>
          <div className="border border-border bg-bg-base rounded-2xl p-8">
            <h2 className="text-text-primary font-bold text-xl mb-4">Scope Reports</h2>
            <div className="space-y-4 text-text-secondary text-sm leading-relaxed">
              <p>
                Every inspection we do is documented in Scope Reports — a tool we built specifically
                for this process. It captures the customer intake, the photos, the damage tags, and
                the diagnosis in one place. The rep uses it during the inspection. The homeowner
                gets a link to their report the same day.
              </p>
              <p>
                The report lives at{" "}
                <span className="text-text-primary font-medium">app.scopereports.com</span> and
                it&apos;s yours to keep. No account required to view it. Share it however you want.
              </p>
              <p>
                We built it in-house because nothing off the shelf did what we needed. It&apos;s
                not a CRM or a sales tool. It&apos;s a documentation system — one that holds us
                accountable and gives homeowners something real to walk away with.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Powered by Qntum */}
      <section className="px-5 py-10 max-w-5xl mx-auto">
        <div className="border border-border bg-bg-surface rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-text-primary font-semibold text-base mb-1">Powered by Qntum Roofing</p>
            <p className="text-text-secondary text-sm">
              Owens Corning Preferred Contractor serving El Paso, Las Cruces, and Alamogordo.
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
          Request Your Free Inspection →
        </a>
      </section>
    </>
  );
}
