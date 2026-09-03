/**
 * The "what this is built on" product name shown on the self-service
 * business-audit results page. Real estate has a real, already-shipped
 * product name (Samvid OS - proven end-to-end on the Office on Rent client
 * build, see nemnidhi-ecosystem-map). Every other industry has no named
 * product yet: per the confirmed sales motion, real vertical software only
 * gets built (and named) once an actual client from that industry signs -
 * the "20 industries" marketing motion deliberately stays ahead of that. So
 * the fallback keeps the same "<Industry> OS" naming pattern under the
 * Nemnidhi umbrella rather than inventing a placeholder brand name that
 * would need retiring later.
 */
const NAMED_PRODUCTS: Record<string, string> = {
  real_estate: "Samvid OS",
};

export function getProductBrand(industryKey: string | null | undefined, industryLabel: string): string {
  if (industryKey && NAMED_PRODUCTS[industryKey]) return NAMED_PRODUCTS[industryKey];
  return `${industryLabel} OS`;
}
