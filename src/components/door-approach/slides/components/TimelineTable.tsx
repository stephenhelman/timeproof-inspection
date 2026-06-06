interface Props {
  colorMode: "light" | "dark";
  keys: string[];
  rows: Record<string, string>[];
}

export function TimelineTable({ colorMode, keys, rows }: Props) {
  const tableColorScheme = {
    light: {
      header: "#0D1A32",
      headerText: "#FFFFFF",
      rowBackground: "#FFFFFF",
      cellBorder: "#E4EEF4",
      colText: ["#4A7FA5", "#4A5568", "#8B1F1F"],
    },
    dark: {
      header: "#0D1A32",
      headerText: "#E8EDF5",
      rowBackground: "#131D30",
      cellBorder: "#1E2D45",
      colText: ["#7AB3D4", "#94A3B8", "#F87171"],
    },
  };
  const C = tableColorScheme[colorMode];

  const tableheader = (
    <div className="grid grid-cols-6 rounded-tl-lg rounded-tr-lg">
      {keys.map((key, i) => {
        return (
          <span
            key={i}
            style={{
              gridColumn: `span ${i + 1} / span ${i + 1}`,
              backgroundColor: C.header,
              color: C.headerText,
            }}
            className={`p-4 ${i === 0 ? "rounded-tl-lg" : ""} ${i === 2 ? "rounded-tr-lg" : ""} text-[14px]`}
          >
            {key}
          </span>
        );
      })}
    </div>
  );

  const renderRow = (i: number, textColor: string, text: string) => {
    return (
      <span
        style={{
          color: textColor,
          gridColumn: `span ${i + 1} / span ${i + 1}`,
          borderRight: `${i < 2 ? `2px solid ${C.cellBorder}` : ""}`,
          borderLeft: `${i > 0 ? `2px solid ${C.cellBorder}` : ""}`,
        }}
        className="px-4 py-8 text-[16px]"
      >
        {text}
      </span>
    );
  };

  const tableRows = rows.map((row, i) => {
    return (
      <div
        key={i}
        style={{
          backgroundColor: C.rowBackground,
          borderTop: `2px solid ${C.cellBorder}`,
        }}
        className={`grid grid-cols-6 ${i === rows.length - 1 ? "rounded-b-lg" : ""}`}
      >
        {Object.values(row).map((value, j) => {
          return renderRow(j, C.colText[j], value);
        })}
      </div>
    );
  });

  return (
    <div>
      {tableheader}
      {tableRows}
    </div>
  );
}
