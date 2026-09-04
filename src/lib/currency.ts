export interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "PKR", label: "PKR - Pakistani Rupee (Rs.)", symbol: "Rs." },
  { code: "USD", label: "USD - US Dollar ($)", symbol: "$" },
  { code: "EUR", label: "EUR - Euro (€)", symbol: "€" },
  { code: "GBP", label: "GBP - British Pound (£)", symbol: "£" },
  { code: "INR", label: "INR - Indian Rupee (₹)", symbol: "₹" },
  { code: "AED", label: "AED - UAE Dirham (AED)", symbol: "AED" },
  { code: "SAR", label: "SAR - Saudi Riyal (SAR)", symbol: "SAR" },
  { code: "CAD", label: "CAD - Canadian Dollar (CA$)", symbol: "CA$" },
];

export function getCurrencySymbol(code: string = "PKR"): string {
  const found = CURRENCIES.find((c) => c.code.toUpperCase() === (code || "PKR").toUpperCase());
  return found ? found.symbol : "Rs.";
}

export function formatMoney(amount: number | string, code: string = "PKR"): string {
  const num = typeof amount === "string" ? parseFloat(amount) || 0 : amount;
  const symbol = getCurrencySymbol(code);
  const formattedNum = Math.abs(num).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = num < 0 ? "-" : "";
  return `${sign}${symbol}${formattedNum}`;
}
