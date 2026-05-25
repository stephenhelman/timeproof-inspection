import { notFound } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import QRCode from "qrcode";
import Image from "next/image";
import BusinessCardActions from "./BusinessCardActions";

interface CardPageProps {
  params: { repId: string };
  searchParams: { report?: string };
}

// Public, unauthenticated server component.
export default async function BusinessCardPage({
  params,
  searchParams,
}: CardPageProps) {
  const { repId } = params;
  const reportUuid = searchParams.report;

  const user = await prisma.user.findUnique({
    where: { id: repId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      area: true,
      profileImageUrl: true,
      cardShowPhone: true,
      cardShowEmail: true,
      cardShowArea: true,
      cardShowReportLink: true,
      cardShowQr: true,
      cardShowProfileImage: true,
    },
  });

  if (!user) notFound();

  // Resolve report link if provided and toggle is on
  let reportUrl: string | null = null;
  if (reportUuid && user.cardShowReportLink) {
    const inspection = await prisma.inspection.findFirst({
      where: { reportUuid, userId: repId },
      select: { reportUuid: true },
    });
    if (inspection) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      reportUrl = `${appUrl}/summary/${inspection.reportUuid}`;
    }
  }

  // Generate QR code — dark navy dots on light background for contrast on dark card
  let qrDataUrl: string | null = null;
  if (user.cardShowQr) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const cardUrl = reportUuid
      ? `${appUrl}/card/${repId}?report=${reportUuid}`
      : `${appUrl}/card/${repId}`;
    qrDataUrl = await QRCode.toDataURL(cardUrl, {
      width: 160,
      margin: 2,
      color: { dark: "#0a0e1a", light: "#E4EEF4" },
    });
  }

  // Build VCF content from enabled fields only (used by client component)
  const vcfLines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${user.name ?? ""}`,
    ...(user.cardShowPhone && user.phone
      ? [`TEL;TYPE=CELL:${user.phone}`]
      : []),
    ...(user.cardShowEmail ? [`EMAIL:${user.email}`] : []),
    ...(user.cardShowArea && user.area ? [`ADR:;;${user.area};;;;`] : []),
    "END:VCARD",
  ];
  const vcfContent = vcfLines.join("\r\n");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const pageUrl = reportUuid
    ? `${appUrl}/card/${repId}?report=${reportUuid}`
    : `${appUrl}/card/${repId}`;

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="bg-bg-surface rounded-2xl border border-border overflow-hidden w-full max-w-sm shadow-2xl">

        {/* Header — logo on dark */}
        <div className="bg-bg-elevated border-b border-border flex items-center justify-center py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/qntum-logo.svg" alt="Qntum Roofing" style={{ height: "30px", width: "auto" }} />
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Photo + name */}
          <div className="flex flex-col items-center gap-3 pb-1">
            {user.cardShowProfileImage && user.profileImageUrl ? (
              <Image
                src={user.profileImageUrl}
                alt={user.name ?? ""}
                width={112}
                height={112}
                className="w-28 h-28 rounded-full object-cover ring-4 ring-border shadow-lg"
              />
            ) : user.cardShowProfileImage ? (
              <div className="w-28 h-28 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-primary text-4xl font-bold shadow-lg">
                {(user.name ?? "?")[0]?.toUpperCase()}
              </div>
            ) : null}
            <div className="text-center">
              <p className="text-text-primary font-bold text-2xl leading-tight">
                {user.name}
              </p>
              <p className="text-text-secondary text-sm mt-1">Roofing Specialist</p>
            </div>
          </div>

          {/* Contact details */}
          {(user.cardShowPhone || user.cardShowEmail || user.cardShowArea) && (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              {user.cardShowPhone && user.phone && (
                <a
                  href={`tel:${user.phone}`}
                  className="flex items-center gap-3 text-text-secondary text-sm hover:text-text-primary transition-colors group"
                >
                  <span className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center shrink-0 transition-colors group-hover:border-border-hover">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </span>
                  {user.phone}
                </a>
              )}
              {user.cardShowEmail && (
                <a
                  href={`mailto:${user.email}`}
                  className="flex items-center gap-3 text-text-secondary text-sm hover:text-text-primary transition-colors group"
                >
                  <span className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center shrink-0 transition-colors group-hover:border-border-hover">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </span>
                  {user.email}
                </a>
              )}
              {user.cardShowArea && user.area && (
                <div className="flex items-center gap-3 text-text-secondary text-sm">
                  <span className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </span>
                  {user.area}
                </div>
              )}
            </div>
          )}

          {/* Report link */}
          {user.cardShowReportLink && reportUrl && (
            <a
              href={reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-brand-blue/10 hover:bg-brand-blue/15 border border-brand-blue/25 rounded-xl px-4 py-3 transition-colors"
            >
              <svg className="w-5 h-5 text-text-secondary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="text-text-primary font-medium text-sm">
                View your scope report
              </span>
            </a>
          )}

          {/* Free Roof Health Guide */}
          <a
            href={`${process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://scopereports.com"}/roof-guide?source=card&rep=${repId}`}
            className="flex items-center gap-3 bg-bg-elevated hover:bg-bg-base border border-border hover:border-border-hover rounded-xl px-4 py-3 transition-colors"
          >
            <svg className="w-5 h-5 text-text-secondary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="text-text-primary font-medium text-sm">
              Get Your Free Roof Health Guide
            </span>
          </a>

          {/* QR code */}
          {user.cardShowQr && qrDataUrl && (
            <div className="flex flex-col items-center gap-2 pt-2 border-t border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR code"
                width={120}
                height={120}
                className="rounded-lg"
              />
              <p className="text-text-hint text-xs">Scan to save contact</p>
            </div>
          )}

          {/* Client-side action buttons */}
          <BusinessCardActions
            name={user.name ?? ""}
            vcfContent={vcfContent}
            shareUrl={pageUrl}
            shareTitle={`${user.name ?? "Roofing Rep"} — Contact Card`}
          />
        </div>

        {/* Footer */}
        <div className="border-t border-border py-3 flex items-center justify-center">
          <span className="text-text-hint text-xs tracking-wide">Qntum Roofing</span>
        </div>
      </div>
    </div>
  );
}
