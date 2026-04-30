const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "decimal",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAmount(value: number): string {
  return currencyFormatter.format(value);
}
