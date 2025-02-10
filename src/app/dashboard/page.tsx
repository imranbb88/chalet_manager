'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { formatCurrency } from '@/utils/formatters';

interface Transaction {
  id: string;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
}

interface SummaryData {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  recentTransactions: Transaction[];
  monthlyData: {
    month: string;
    income: number;
    expenses: number;
  }[];
}

const getDateRangePreset = (preset: 'thisMonth' | 'lastMonth' | 'last3Months' | 'thisYear') => {
  const today = new Date();
  const startDate = new Date();
  
  switch (preset) {
    case 'thisMonth':
      startDate.setDate(1);
      break;
    case 'lastMonth':
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setDate(1);
      break;
    case 'last3Months':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case 'thisYear':
      startDate.setMonth(0);
      startDate.setDate(1);
      break;
  }
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0]
  };
};

export default function DashboardPage() {
  const [summaryData, setSummaryData] = useState<SummaryData>({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    recentTransactions: [],
    monthlyData: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0], // Last month
    endDate: new Date().toISOString().split('T')[0] // Today
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchDashboardData = useCallback(async () => {
    try {
      // Adjust end date to include the entire day
      const endDateWithTime = new Date(dateRange.endDate);
      endDateWithTime.setHours(23, 59, 59, 999);
      
      // Fetch income within date range
      const { data: incomeData, error: incomeError } = await supabase
        .from('income')
        .select('*')
        .gte('date', dateRange.startDate)
        .lte('date', dateRange.endDate)
        .order('date', { ascending: false });

      if (incomeError) throw incomeError;

      // Fetch expenses within date range
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', dateRange.startDate)
        .lte('date', dateRange.endDate)
        .order('date', { ascending: false });

      if (expenseError) throw expenseError;

      // Calculate totals
      const totalIncome = incomeData?.reduce((sum, item) => sum + item.amount, 0) || 0;
      const totalExpenses = expenseData?.reduce((sum, item) => sum + item.amount, 0) || 0;
      const netProfit = totalIncome - totalExpenses;

      // Combine and sort recent transactions
      const recentTransactions: Transaction[] = [
        ...(incomeData?.map(income => ({
          id: income.id,
          date: income.date,
          type: 'INCOME' as const,
          amount: income.amount,
          description: income.description
        })) || []),
        ...(expenseData?.map(expense => ({
          id: expense.id,
          date: expense.date,
          type: 'EXPENSE' as const,
          amount: expense.amount,
          description: expense.description
        })) || [])
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

      // Calculate monthly data
      const monthlyDataMap = new Map<string, { income: number; expenses: number }>();
      
      // Initialize months
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const monthKey = currentDate.toISOString().slice(0, 7); // YYYY-MM format
        monthlyDataMap.set(monthKey, { income: 0, expenses: 0 });
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // Aggregate income by month
      incomeData?.forEach(income => {
        const monthKey = income.date.slice(0, 7);
        const monthData = monthlyDataMap.get(monthKey) || { income: 0, expenses: 0 };
        monthlyDataMap.set(monthKey, {
          ...monthData,
          income: monthData.income + income.amount
        });
      });

      // Aggregate expenses by month
      expenseData?.forEach(expense => {
        const monthKey = expense.date.slice(0, 7);
        const monthData = monthlyDataMap.get(monthKey) || { income: 0, expenses: 0 };
        monthlyDataMap.set(monthKey, {
          ...monthData,
          expenses: monthData.expenses + expense.amount
        });
      });

      const monthlyData = Array.from(monthlyDataMap.entries())
        .map(([month, data]) => ({
          month,
          income: data.income,
          expenses: data.expenses
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      setSummaryData({
        totalIncome,
        totalExpenses,
        netProfit,
        recentTransactions,
        monthlyData
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, dateRange]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleDateRangeChange = (newRange: { startDate: string; endDate: string }) => {
    // Validate that end date is not before start date
    if (newRange.endDate < newRange.startDate) {
      alert('End date cannot be before start date');
      return;
    }
    setDateRange(newRange);
  };

  const handleReset = async () => {
    try {
      // Fetch oldest income record
      const { data: oldestIncome, error: incomeError } = await supabase
        .from('income')
        .select('date')
        .order('date', { ascending: true })
        .limit(1);

      if (incomeError) throw incomeError;

      // Fetch oldest expense record
      const { data: oldestExpense, error: expenseError } = await supabase
        .from('expenses')
        .select('date')
        .order('date', { ascending: true })
        .limit(1);

      if (expenseError) throw expenseError;

      // Find the earliest date between income and expenses
      let startDate = new Date().toISOString().split('T')[0]; // Default to today
      
      if (oldestIncome?.[0]?.date) {
        startDate = oldestIncome[0].date;
      }
      
      if (oldestExpense?.[0]?.date && oldestExpense[0].date < startDate) {
        startDate = oldestExpense[0].date;
      }

      // Set date range from oldest record to today
      setDateRange({
        startDate,
        endDate: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Error finding oldest record:', error);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Dashboard
          </h2>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 md:ml-4 md:mt-0">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleDateRangeChange(getDateRangePreset('thisMonth'))}
              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              This Month
            </button>
            <button
              onClick={() => handleDateRangeChange(getDateRangePreset('lastMonth'))}
              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Last Month
            </button>
            <button
              onClick={() => handleDateRangeChange(getDateRangePreset('last3Months'))}
              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Last 3 Months
            </button>
            <button
              onClick={() => handleDateRangeChange(getDateRangePreset('thisYear'))}
              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              This Year
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              All Time
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Inputs */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            value={dateRange.startDate}
            onChange={(e) => handleDateRangeChange({ ...dateRange, startDate: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
            End Date
          </label>
          <input
            type="date"
            id="endDate"
            value={dateRange.endDate}
            onChange={(e) => handleDateRangeChange({ ...dateRange, endDate: e.target.value })}
            max={new Date().toISOString().split('T')[0]}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Income</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatCurrency(summaryData.totalIncome)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Expenses</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatCurrency(summaryData.totalExpenses)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg sm:col-span-2 lg:col-span-1">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Net Profit</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatCurrency(summaryData.netProfit)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {summaryData.recentTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(transaction.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      transaction.type === 'INCOME' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(transaction.amount)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 truncate max-w-xs">{transaction.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 