const precioFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** formatPrecio(42500000) → "$ 42.500.000,00" */
export function formatPrecio(n: number): string {
  return `$ ${precioFormatter.format(n)}`;
}
