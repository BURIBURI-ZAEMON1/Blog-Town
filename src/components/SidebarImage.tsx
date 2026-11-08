type Props = { src: string; alt: string; className?: string; mobileOpen: boolean };

/** SSR must not download hidden sidebar artwork on a phone before hydration. */
export default function SidebarImage({ src, alt, className, mobileOpen }: Props) {
  return <picture style={{ display: 'contents' }}>
    <source media="(min-width: 721px)" srcSet={src} />
    <img src={mobileOpen ? src : undefined} alt={alt} className={className} decoding="async" />
  </picture>;
}
