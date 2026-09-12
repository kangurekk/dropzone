type AvatarImageProps = {
  src: string;
  alt: string;
  focalX?: number;
  focalY?: number;
  zoom?: number;
  className?: string;
};

export default function AvatarImage({
  src,
  alt,
  focalX = 50,
  focalY = 50,
  zoom = 1,
  className = "",
}: AvatarImageProps) {
  if (!src.startsWith("/uploads/")) {
    return <span className={className}>{src}</span>;
  }

  return (
    <div
      className={`relative overflow-hidden bg-[#0e1017] ${className}`}
      style={{
        isolation: "isolate",
        backgroundImage: `url("${src}")`,
        backgroundSize: zoom === 1 ? "cover" : `${zoom * 100}%`,
        backgroundPosition: `${focalX}% ${focalY}%`,
        backgroundRepeat: "no-repeat",
        // Force high-quality scaler (Chrome fast-path bug with small GIFs)
        imageRendering: "-webkit-optimize-contrast",
      }}
      role="img"
      aria-label={alt}
    />
  );
}