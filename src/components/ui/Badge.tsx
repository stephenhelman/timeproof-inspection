interface BadgeProps {
  status: "draft" | "complete";
}

export default function Badge({ status }: BadgeProps) {
  return (
    <span
      className={`text-xs px-3 py-1 rounded-full font-medium ${
        status === "complete"
          ? "bg-success text-success-text"
          : "bg-bg-elevated text-text-secondary"
      }`}
    >
      {status === "complete" ? "Complete" : "Draft"}
    </span>
  );
}
