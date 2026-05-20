interface LogoProps {
  className?: string;
  height?: number;
  background?: "white" | "black" | "none";
}

export default function Logo({ className = "", height = 40, background = "white" }: LogoProps) {
  const bg =
    background === "white" ? "bg-white" :
    background === "black" ? "bg-black" :
    "";

  return (
    <div className={`inline-flex items-center justify-center px-2 py-1 rounded-lg ${bg} ${className}`}>
      <img
        src="/logo.png"
        alt="Qntum Roofing"
        style={{ height: `${height}px`, width: "auto" }}
      />
    </div>
  );
}
