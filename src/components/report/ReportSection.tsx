import React from "react";

interface ReportSectionProps {
  sectionKey: string;
  title?: string;
  children: React.ReactNode;
}

export default function ReportSection({ sectionKey, title, children }: ReportSectionProps) {
  return (
    <section
      data-section={sectionKey}
      className="bg-gray-50 border border-gray-200 rounded-xl p-6 flex flex-col gap-4"
    >
      {title && (
        <h2 className="text-gray-900 font-semibold text-xl">{title}</h2>
      )}
      {children}
    </section>
  );
}
