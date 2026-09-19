import Image from "next/image";

export function VegaLogo({
  horizontal = false,
  className,
}: {
  horizontal?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={horizontal ? "/vega-logo-premium-horizontal.svg" : "/vega-logo-premium.svg"}
      alt={horizontal ? "Vega Command Center" : "Vega"}
      width={horizontal ? 1180 : 512}
      height={horizontal ? 320 : 512}
      className={className}
      unoptimized
    />
  );
}
