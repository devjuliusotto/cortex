import cortexLogo from "@/assets/cortex-logo.svg";

type CortexLogoProps = {
  className?: string;
};

export function CortexLogo({ className }: CortexLogoProps) {
  return <img alt="Cortex" className={className} src={cortexLogo} />;
}
