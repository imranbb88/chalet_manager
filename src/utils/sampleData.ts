// Random amount generator between min and max
const randomAmount = (min: number, max: number) => 
  Number((Math.random() * (max - min) + min).toFixed(2));

// Random date within last 3 months
const randomDate = () => {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
};

const incomeDescriptions = [
  'Weekend Rental',
  'Week-long Stay',
  'Holiday Package',
  'Extended Stay',
  'Last Minute Booking',
  'Special Event Rental',
  'Corporate Retreat',
  'Family Gathering'
];

const expenseDescriptions = [
  'Monthly Utilities',
  'Cleaning Service',
  'Maintenance Repair',
  'Property Insurance',
  'New Furniture',
  'Landscaping',
  'Plumbing Fix',
  'Electrical Work'
];

export const generateSampleIncome = (count: number = 5) => {
  return Array.from({ length: count }, () => ({
    date: randomDate(),
    amount: randomAmount(500, 2000),
    description: incomeDescriptions[Math.floor(Math.random() * incomeDescriptions.length)],
    category: ['RENTAL', 'SERVICES', 'OTHER'][Math.floor(Math.random() * 3)]
  }));
};

export const generateSampleExpenses = (count: number = 5) => {
  return Array.from({ length: count }, () => ({
    date: randomDate(),
    amount: randomAmount(100, 800),
    description: expenseDescriptions[Math.floor(Math.random() * expenseDescriptions.length)],
    category: ['MAINTENANCE', 'UTILITIES', 'SUPPLIES', 'CLEANING', 'INSURANCE', 'OTHER'][Math.floor(Math.random() * 6)]
  }));
}; 