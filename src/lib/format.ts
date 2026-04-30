const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "decimal",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatAmount(value: number): string {
  return currencyFormatter.format(value);
}
