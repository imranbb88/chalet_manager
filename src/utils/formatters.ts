export const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}; 