type Stat = {
  stat: string;
  body: string;
};

interface Props {
  stats: Stat[];
  cardColor: string;
  titleColor: string;
  subtextColor: string;
}

function StatCard({
  stat,
  body,
  cardColor,
  titleColor,
  subtextColor,
}: {
  stat: string;
  body: string;
  cardColor: string;
  titleColor: string;
  subtextColor: string;
}) {
  return (
    <div
      className="col-span-1 p-2 rounded-lg flex flex-col justify-center items-center"
      style={{ backgroundColor: cardColor }}
    >
      <p className="text-[28px] font-bold" style={{ color: titleColor }}>
        {stat}
      </p>
      <p className="text-[9px]" style={{ color: subtextColor }}>
        {body}
      </p>
    </div>
  );
}

export function StatRow({ stats, cardColor, titleColor, subtextColor }: Props) {
  const content = stats.map((stat, i) => {
    return (
      <StatCard
        key={i}
        stat={stat.stat}
        body={stat.body}
        cardColor={cardColor}
        titleColor={titleColor}
        subtextColor={subtextColor}
      />
    );
  });
  return (
    <div
      style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}
      className="grid gap-3"
    >
      {content}
    </div>
  );
}
