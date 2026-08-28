type Props = {
  src: string;
  alt: string;
  className?: string;
};

export function LandingPhoto({ src, alt, className = "" }: Props) {
  return (
    <div className={`overflow-hidden rounded-[0.45rem] shadow-sm ${className}`}>
      {/* Local Kenyan photography from the 16 Aug production site. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-full w-full max-w-none object-cover object-center" />
    </div>
  );
}
