import HeaderSection from './HeaderSection.astro';
import HeroSection from './HeroSection.astro';
import ProductGridSection from './ProductGridSection.astro';
import CategoryGridSection from './CategoryGridSection.astro';
import SearchSection from './SearchSection.astro';
import FooterSection from './FooterSection.astro';

/**
 * Mapea section.type → componente Astro.
 *
 * La clave debe coincidir EXACTAMENTE con el `key` del SectionType
 * registrado en el admin de Proxima (o en proxima.template.json).
 *
 * Añadir aquí cada nuevo section type que implementes.
 */
export const SECTION_MAP: Record<string, any> = {
  header: HeaderSection,
  hero: HeroSection,
  product_grid: ProductGridSection,
  category_grid: CategoryGridSection,
  search: SearchSection,
  footer: FooterSection,
};
