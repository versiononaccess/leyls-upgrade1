import { supabase } from '../lib/supabase';

export interface WalletTransaction {
  id: string;
  restaurant_id: string;
  customer_id: string;
  type: 'top_up' | 'payment' | 'refund' | 'adjustment';
  amount: number;
  balance_after: number;
  description?: string;
  reference_type?: 'order' | 'qr_payment' | 'manual';
  reference_id?: string;
  staff_id?: string;
  branch_id?: string;
  created_at: string;
}

export class WalletService {
  static async getWalletBalance(restaurantId: string, customerId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('wallet_balance')
        .eq('id', customerId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error) throw error;
      return data?.wallet_balance || 0;
    } catch (error: any) {
      console.error('Error getting wallet balance:', error);
      return 0;
    }
  }

  static async getWalletTransactions(
    restaurantId: string,
    customerId: string
  ): Promise<WalletTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('customer_id', customerId)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error getting wallet transactions:', error);
      return [];
    }
  }

  static async topUpWallet(
    restaurantId: string,
    customerId: string,
    amount: number,
    description: string,
    staffId?: string,
    branchId?: string
  ): Promise<string> {
    try {
      if (amount <= 0) {
        throw new Error('Top-up amount must be greater than zero');
      }

      const { data, error } = await supabase.rpc('process_wallet_transaction', {
        p_restaurant_id: restaurantId,
        p_customer_id: customerId,
        p_type: 'top_up',
        p_amount: amount,
        p_description: description,
        p_reference_type: 'manual',
        p_reference_id: null,
        p_staff_id: staffId,
        p_branch_id: branchId,
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error topping up wallet:', error);
      throw new Error(error.message || 'Failed to top up wallet');
    }
  }

  static async undoTopUp(
    restaurantId: string,
    transactionId: string,
    staffId?: string
  ): Promise<void> {
    try {
      const { data: transaction, error: fetchError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('restaurant_id', restaurantId)
        .eq('type', 'top_up')
        .single();

      if (fetchError) throw fetchError;
      if (!transaction) throw new Error('Transaction not found');

      const timeDiff = Date.now() - new Date(transaction.created_at).getTime();
      if (timeDiff > 5 * 60 * 1000) {
        throw new Error('Cannot undo top-up after 5 minutes');
      }

      const { error } = await supabase.rpc('process_wallet_transaction', {
        p_restaurant_id: restaurantId,
        p_customer_id: transaction.customer_id,
        p_type: 'adjustment',
        p_amount: -transaction.amount,
        p_description: `Undo top-up: ${transaction.description}`,
        p_reference_type: 'manual',
        p_reference_id: transactionId,
        p_staff_id: staffId,
        p_branch_id: transaction.branch_id,
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Error undoing top-up:', error);
      throw new Error(error.message || 'Failed to undo top-up');
    }
  }

  static async payWithWallet(
    restaurantId: string,
    customerId: string,
    amount: number,
    description: string,
    referenceType: 'order' | 'qr_payment',
    referenceId: string,
    branchId?: string
  ): Promise<string> {
    try {
      if (amount <= 0) {
        throw new Error('Payment amount must be greater than zero');
      }

      const canAfford = await this.canAffordAmount(restaurantId, customerId, amount);
      if (!canAfford) {
        throw new Error('Insufficient wallet balance');
      }

      const { data, error } = await supabase.rpc('process_wallet_transaction', {
        p_restaurant_id: restaurantId,
        p_customer_id: customerId,
        p_type: 'payment',
        p_amount: -amount,
        p_description: description,
        p_reference_type: referenceType,
        p_reference_id: referenceId,
        p_staff_id: null,
        p_branch_id: branchId,
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error processing wallet payment:', error);
      throw new Error(error.message || 'Failed to process payment');
    }
  }

  static async refundToWallet(
    restaurantId: string,
    customerId: string,
    amount: number,
    description: string,
    referenceType?: 'order' | 'qr_payment',
    referenceId?: string,
    branchId?: string
  ): Promise<string> {
    try {
      if (amount <= 0) {
        throw new Error('Refund amount must be greater than zero');
      }

      const { data, error } = await supabase.rpc('process_wallet_transaction', {
        p_restaurant_id: restaurantId,
        p_customer_id: customerId,
        p_type: 'refund',
        p_amount: amount,
        p_description: description,
        p_reference_type: referenceType,
        p_reference_id: referenceId,
        p_staff_id: null,
        p_branch_id: branchId,
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error refunding to wallet:', error);
      throw new Error(error.message || 'Failed to refund');
    }
  }

  static async canAffordAmount(
    restaurantId: string,
    customerId: string,
    amount: number
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('can_customer_afford_order', {
        p_customer_id: customerId,
        p_restaurant_id: restaurantId,
        p_order_amount: amount,
      });

      if (error) throw error;
      return data || false;
    } catch (error: any) {
      console.error('Error checking affordability:', error);
      return false;
    }
  }

  static async processQRPayment(
    restaurantId: string,
    customerId: string,
    amount: number,
    branchId: string,
    staffId?: string
  ): Promise<string> {
    try {
      const qrPaymentId = crypto.randomUUID();

      return await this.payWithWallet(
        restaurantId,
        customerId,
        amount,
        `QR Payment - ${amount} AED`,
        'qr_payment',
        qrPaymentId,
        branchId
      );
    } catch (error: any) {
      console.error('Error processing QR payment:', error);
      throw error;
    }
  }
}
