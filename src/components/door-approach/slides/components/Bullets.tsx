import { COLOR_CONFIG } from "../../colorConfig";

type Item = {
  title: string;
  body: string;
  question: string;
};

type CardType = {
  colorMode: "light" | "dark";
  item: Item;
  i: number;
};

interface Props {
  items: Item[];
  colorMode: "light" | "dark";
}

function Card({ colorMode, item, i }: CardType) {
  const C = COLOR_CONFIG[colorMode];
  return (
    <div
      style={{ backgroundColor: C.cardBackground }}
      className="flex items-center rounded-lg"
    >
      <div
        style={{ color: C.cardTitle }}
        className="text-2xl w-14 mx-auto text-center"
      >
        0{i + 1}
      </div>
      <div
        className="p-3 flex flex-col gap-6 border-l-2 max-w-2xl"
        style={{ borderColor: C.blue }}
      >
        <p style={{ color: C.title }} className="text-lg">
          {item.title}
        </p>
        <p style={{ color: C.subtitle }} className="text-md">
          {item.body}
        </p>
        <p
          className="p-2 mt-auto text-lg text-center rounded-lg"
          style={{ backgroundColor: C.question, color: C.textPrimary }}
        >
          {item.question}
        </p>
      </div>
    </div>
  );
}

export function Bullets({ items, colorMode }: Props) {
  const content = items.map((item, i) => {
    return <Card colorMode={colorMode} item={item} i={i} />;
  });
  return <div className="flex flex-col gap-4">{content}</div>;
}
