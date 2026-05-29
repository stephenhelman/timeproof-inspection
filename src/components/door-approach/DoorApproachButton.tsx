import { Presentation } from "lucide-react";

interface Props {
  mobile?: boolean;
}

export default function DoorApproachButton({ mobile = false }: Props) {
  const cls = mobile
    ? "flex items-center gap-1.5 shrink-0 text-text-secondary hover:text-text-primary text-sm px-4 py-2.5 transition-colors"
    : "flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm px-3 py-2 rounded-lg hover:bg-bg-elevated transition-colors";

  return (
    <a href="/door-approach" className={cls}>
      <Presentation size={mobile ? 14 : 15} strokeWidth={1.75} />
      Door Approach
    </a>
  );
}
