interface Props {
  children: React.ReactNode;
}

export function Slide({ children }: Props) {
  return (
    <div className="py-4 max-w-180 mx-auto w-full min-h-full flex flex-col">
      {children}
    </div>
  );
}
