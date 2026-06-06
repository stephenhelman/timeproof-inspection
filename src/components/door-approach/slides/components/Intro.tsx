interface Props {
  text: string;
  color: string;
}

export function Intro({ text, color }: Props) {
  return (
    <p className="text-[14px] leading-relaxed mb-6" style={{ color }}>
      {text}
    </p>
  );
}
