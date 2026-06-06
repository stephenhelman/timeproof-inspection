interface Props {
  text: string;
  color: string;
}

export function Header({ text, color }: Props) {
  return (
    <div className="flex justify-center items-center mb-3">
      <span
        className="border-b border-gray-400 w-6 mr-1.5 self-center"
        style={{ color }}
      ></span>
      <p
        className="text-[10px] font-bold tracking-[0.25em] uppercase text-nowrap"
        style={{ color }}
      >
        {text}
      </p>
      <span
        className="border-b border-gray-400 ml-8 flex-2 self-center"
        style={{ color }}
      ></span>
    </div>
  );
}
