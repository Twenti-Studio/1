export default function Logo({ className = "h-8 w-auto", glow = false }) {
  return (
    <img
      src="/logo.jpeg"
      alt="FiNot"
      className={className}
      draggable={false}
      style={glow ? { filter: "brightness(1.3) drop-shadow(0 0 8px rgba(245,132,31,0.6))" } : undefined}
    />
  );
}
