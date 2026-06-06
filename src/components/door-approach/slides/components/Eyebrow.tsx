interface Props {
  text: string;
  color: string;
}

export function Eyebrow({ text, color }: Props) {
  return (
    <div className="flex w-full items-center justify-center">
      <p
        className="text-s font-bold tracking-[0.25em] uppercase mb-3"
        style={{ color }}
      >
        {text}
      </p>
    </div>
  );
}
