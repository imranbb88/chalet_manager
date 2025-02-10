'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Income } from '@/types/database.types';
import { generateSampleIncome } from '@/utils/sampleData';

export default function IncomePage() {
  const [incomeEntries, setIncomeEntries] = useState<Income[]>([]);
  const [formData, setFormData] = useState({
    date: '',
    amount: '',
    description: '',
    category: 'RENTAL'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchIncomeEntries = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('income')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        setIncomeEntries(data);
      }
    } catch (error) {
      console.error('Error fetching income entries:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchIncomeEntries();
  }, [fetchIncomeEntries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('income')
        .insert([
          {
            date: formData.date,
            amount: parseFloat(formData.amount),
            description: formData.description,
            category: formData.category
          }
        ])
        .select();

      if (error) {
        throw error;
      }

      if (data) {
        setIncomeEntries([...data, ...incomeEntries]);
        setFormData({ date: '', amount: '', description: '', category: 'RENTAL' });
      }
    } catch (error) {
      console.error('Error adding income entry:', error);
    }
  };

  const handleGenerateSampleData = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    
    try {
      const sampleData = generateSampleIncome(5);
      const { data, error } = await supabase
        .from('income')
        .insert(sampleData)
        .select();

      if (error) {
        throw error;
      }

      if (data) {
        setIncomeEntries([...data, ...incomeEntries]);
      }
    } catch (error) {
      console.error('Error generating sample data:', error);
    } finally {
      setIsGenerating(false);
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
            Income Management
          </h2>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0">
          <button
            type="button"
            onClick={handleGenerateSampleData}
            disabled={isGenerating}
            className="ml-3 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate Sample Data'}
          </button>
        </div>
      </div>

      {/* Income Form */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Add New Income</h3>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                  Date
                </label>
                <input
                  type="date"
                  id="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                  Amount ($)
                </label>
                <input
                  type="number"
                  id="amount"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <input
                  type="text"
                  id="description"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                  Category
                </label>
                <select
                  id="category"
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="RENTAL">Rental</option>
                  <option value="SERVICE">Service</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Add Income
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Income List */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Income History</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Amount</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Description</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {incomeEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{entry.date}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${entry.amount.toFixed(2)}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{entry.description}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{entry.category}</td>
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