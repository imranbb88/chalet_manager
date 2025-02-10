'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Expense } from '@/types/database.types';
import { generateSampleExpenses } from '@/utils/sampleData';

export default function ExpensesPage() {
  const [expenseEntries, setExpenseEntries] = useState<Expense[]>([]);
  const [formData, setFormData] = useState({
    date: '',
    amount: '',
    description: '',
    category: 'MAINTENANCE'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchExpenseEntries();
  }, []);

  async function fetchExpenseEntries() {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        setExpenseEntries(data);
      }
    } catch (error) {
      console.error('Error fetching expense entries:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('expenses')
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
        setExpenseEntries([...data, ...expenseEntries]);
        setFormData({ date: '', amount: '', description: '', category: 'MAINTENANCE' });
      }
    } catch (error) {
      console.error('Error adding expense entry:', error);
    }
  };

  const handleGenerateSampleData = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    
    try {
      const sampleData = generateSampleExpenses(5);
      const { data, error } = await supabase
        .from('expenses')
        .insert(sampleData)
        .select();

      if (error) {
        throw error;
      }

      if (data) {
        setExpenseEntries([...data, ...expenseEntries]);
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
            Expense Management
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

      {/* Expense Form */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Add New Expense</h3>
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
              <div className="sm:col-span-2">
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
              <div className="sm:col-span-2">
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                  Category
                </label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="UTILITIES">Utilities</option>
                  <option value="SUPPLIES">Supplies</option>
                  <option value="CLEANING">Cleaning</option>
                  <option value="INSURANCE">Insurance</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Add Expense
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Expense List */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Expense History</h3>
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
                {expenseEntries.map((entry) => (
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