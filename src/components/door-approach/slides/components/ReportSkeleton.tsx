interface Props {
  colorMode: "light" | "dark";
}

export function ReportSkeleton({ colorMode }: Props) {
  const colorConfig = {
    light: {
      backgroundColor: "#f8f9fa",
      placeholder: "#E8EDF5",
      bullet: "#7AB3D4",
      header: "#0d1a32",
      headerText: "#e8edf5",
    },
    dark: {
      backgroundColor: "#162035",
      placeholder: "#1e2d45",
      bullet: "#4a7fa5",
      header: "#0d1a32",
      headerText: "#e8edf5",
    },
  };

  const C = colorConfig[colorMode];

  return (
    <div
      className="rounded-xl overflow-hidden mb-2"
      style={{ background: C.backgroundColor }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: C.header }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/sr_logo_light_transparent.svg"
          alt="Scope Reports"
          style={{ height: 14, width: "auto" }}
        />
        <span className="text-xs font-semibold" style={{ color: C.headerText }}>
          Roof Inspection Report
        </span>
      </div>
      <div className="flex flex-col justify-start items-center w-full max-w-720 p-2">
        <div className="flex items-start gap-3 w-full">
          <div className="flex-1 space-y-1.5 ">
            <div
              className="h-3 rounded"
              style={{ background: C.placeholder, width: "65%" }}
            ></div>
            <div
              className="h-2 rounded"
              style={{
                background: C.placeholder,
                width: "45%",
                opacity: "80%",
              }}
            ></div>
          </div>
          <div
            className="w-12.5 h-12.5 rounded"
            style={{ background: C.placeholder }}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded"
            style={{ aspectRatio: "4/3", background: C.placeholder }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2.5 py-4 px-2">
        <div className="flex items-center gap-2.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: C.bullet }}
          />
          <div
            className="h-2 rounded flex-1"
            style={{ background: C.placeholder }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: C.bullet }}
          />
          <div
            className="h-2 rounded flex-1"
            style={{ background: C.placeholder }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: C.bullet }}
          />
          <div
            className="h-2 rounded flex-1"
            style={{ background: C.placeholder }}
          />
        </div>
      </div>
    </div>
  );
}
