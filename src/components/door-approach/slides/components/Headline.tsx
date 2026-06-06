interface Props {
  text: string;
  color: string;
}

export function Headline({ text, color }: Props) {
  return (
    <h2 className="text-[20px] font-bold mb-4" style={{ color }}>
      {text}
    </h2>
  );
}
