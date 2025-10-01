import React, { useState } from 'react';
import { DollarSign, Search, Plus, CheckCircle, AlertCircle, User } from 'lucide-react';
import { CustomerService } from '../services/customerService';
import { WalletService } from '../services/walletService';

interface WalletTopUpTabProps {
  restaurantId: string;
  branchId: string;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  wallet_balance: number;
}

const WalletTopUpTab: React.FC<WalletTopUpTabProps> = ({ restaurantId, branchId }) => {
  const [customerEmail, setCustomerEmail] = useState('');
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCustomerSearch = async (email: string) => {
    if (!email || email.length < 3) {
      setFoundCustomer(null);
      return;
    }

    try {
      const customer = await CustomerService.getCustomerByEmail(restaurantId, email);
      if (customer) {
        setFoundCustomer(customer);
        setError('');
      } else {
        setFoundCustomer(null);
      }
    } catch (err: any) {
      console.error('Error finding customer:', err);
      setFoundCustomer(null);
    }
  };

  const handleTopUp = async () => {
    if (!foundCustomer) {
      setError('Please search for a customer first');
      return;
    }

    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      await WalletService.addTopUp(foundCustomer.id, amount, `Staff top-up at branch`);

      setSuccess(`Successfully added ${amount.toFixed(2)} AED to wallet`);
      setTopUpAmount('');

      const updatedCustomer = await CustomerService.getCustomerByEmail(restaurantId, foundCustomer.email);
      if (updatedCustomer) {
        setFoundCustomer(updatedCustomer);
      }
    } catch (err: any) {
      console.error('Error adding top-up:', err);
      setError(err.message || 'Failed to add top-up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          Wallet Top-Up
        </h3>
        <p className="text-sm text-gray-600">
          Add balance to customer wallets for orders and payments
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Customer Email
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => {
                setCustomerEmail(e.target.value);
                handleCustomerSearch(e.target.value);
                setSuccess('');
              }}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter customer email"
            />
          </div>
        </div>

        {foundCustomer && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                {foundCustomer.first_name[0]}{foundCustomer.last_name[0]}
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {foundCustomer.first_name} {foundCustomer.last_name}
                </p>
                <p className="text-sm text-gray-600">{foundCustomer.email}</p>
                {foundCustomer.phone && (
                  <p className="text-sm text-gray-600">{foundCustomer.phone}</p>
                )}
              </div>
            </div>
            <div className="p-3 bg-white rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600">Current Wallet Balance</p>
              <p className="text-2xl font-bold text-gray-900">{foundCustomer.wallet_balance.toFixed(2)} AED</p>
            </div>
          </div>
        )}

        {foundCustomer && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Top-Up Amount (AED)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter amount"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        )}

        {foundCustomer && (
          <button
            onClick={handleTopUp}
            disabled={loading || !topUpAmount}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Add to Wallet
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default WalletTopUpTab;
