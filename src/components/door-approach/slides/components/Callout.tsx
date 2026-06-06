interface Props {
  callout: {
    title: string;
    subtext: string;
  };
  highlightColor: string;
  backgroundColor: string;
  titleTextColor: string;
  subtextColor: string;
}

export function Callout({
  callout,
  highlightColor,
  backgroundColor,
  titleTextColor,
  subtextColor,
}: Props) {
  return (
    <div
      className="pl-4 py-3 mt-auto"
      style={{
        borderLeft: `2px solid ${highlightColor}`,
        backgroundColor,
      }}
    >
      <p
        className="text-[12px] leading-relaxed mb-2"
        style={{ color: titleTextColor }}
      >
        {callout.title}
      </p>
      <p
        className="text-[12px] leading-relaxed"
        style={{ color: subtextColor }}
      >
        {callout.subtext}
      </p>
    </div>
  );
}
