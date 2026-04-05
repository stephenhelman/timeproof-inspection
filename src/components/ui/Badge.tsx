interface BadgeProps {
  status: "draft" | "complete";
}

export default function Badge({ status }: BadgeProps) {
  return (
    <span
      className={`text-xs px-3 py-1 rounded-full font-medium ${
        status === "complete"
          ? "bg-green-900 text-green-300"
          : "bg-gray-700 text-gray-300"
      }`}
    >
      {status === "complete" ? "Complete" : "Draft"}
    </span>
  );
}
