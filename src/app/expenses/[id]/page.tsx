"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ExpenseDetail() {
  const params = useParams();
  const router = useRouter();
  const [expense, setExpense] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/expenses/${params.id}`)
      .then(res => res.json())
      .then(data => {
        setExpense(data);
        setLoading(false);
      });
  }, [params.id]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (expense.error) return <div className="p-8 text-center text-red-500">Expense not found</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={() => router.back()} className="text-blue-600 hover:underline">
          &larr; Back
        </button>
      </div>

      <div className="bg-white shadow rounded-xl overflow-hidden border border-gray-100">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-start">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {expense.description}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              {expense.date} • Paid by {expense.paid_by_name}
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-gray-900">₹{Math.abs(expense.amount)}</span>
            {expense.original_currency !== 'INR' && (
              <p className="text-sm text-gray-500">
                ({expense.original_amount} {expense.original_currency} @ {expense.exchange_rate})
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-5">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Split Type</dt>
              <dd className="mt-1 text-sm text-gray-900 capitalize">{expense.split_type}</dd>
            </div>
            {expense.notes && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Notes</dt>
                <dd className="mt-1 text-sm text-gray-900 bg-yellow-50 p-3 rounded">{expense.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="px-6 py-5 bg-gray-50 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-4 uppercase tracking-wider">How it was split</h4>
          <ul className="divide-y divide-gray-200 bg-white rounded-lg border border-gray-200">
            {expense.splits.map((split: any) => (
              <li key={split.member_id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                <span className="font-medium text-gray-900">{split.member_name}</span>
                <span className="text-gray-700">₹{split.share_amount}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
