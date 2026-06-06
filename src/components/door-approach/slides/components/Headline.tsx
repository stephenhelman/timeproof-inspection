interface Props {
  text: string;
  color: string;
}

export function Headline({ text, color }: Props) {
  return (
    <div className="flex w-full items-center justify-center">
      <h2 className="text-[20px] font-bold mb-4" style={{ color }}>
        {text}
      </h2>
    </div>
  );
}
