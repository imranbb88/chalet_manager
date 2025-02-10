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
      const adjustedEndDate = endDateWithTime.toISOString();

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
      let currentDate = new Date(startDate);
      
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
        <div className="mt-4 flex gap-4 md:ml-4 md:mt-0">
          <div className="flex gap-2">
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
          <div className="flex gap-4">
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
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Revenue</dt>
                  <dd className="text-lg font-medium text-gray-900">Rs. {formatCurrency(summaryData.totalIncome)}</dd>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Expenses</dt>
                  <dd className="text-lg font-medium text-gray-900">Rs. {formatCurrency(summaryData.totalExpenses)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Net Profit</dt>
                  <dd className={`text-lg font-medium ${summaryData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Rs. {formatCurrency(summaryData.netProfit)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Analytics */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Monthly Analytics</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Month</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Income</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Expenses</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Profit/Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {summaryData.monthlyData.map((month) => {
                  const profit = month.income - month.expenses;
                  return (
                    <tr key={month.month}>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {new Date(month.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        Rs. {formatCurrency(month.income)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        Rs. {formatCurrency(month.expenses)}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-4 text-sm ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Rs. {formatCurrency(profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Recent Transactions</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Type</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Amount</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {summaryData.recentTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {transaction.date}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          transaction.type === 'INCOME'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {transaction.type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      Rs. {formatCurrency(transaction.amount)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {transaction.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 