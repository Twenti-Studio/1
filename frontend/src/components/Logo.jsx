export default function Logo({ className = "h-8 w-auto", glow = false }) {
  return (
    <img
      src="/finot_logo.png"
      alt="FiNot"
      className={className}
      draggable={false}
      style={glow ? { filter: "drop-shadow(0 1px 6px rgba(245,132,31,0.35))" } : undefined}
    />
  );
}
