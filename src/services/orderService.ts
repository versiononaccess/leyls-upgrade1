import { supabase } from '../lib/supabase';
import { WalletService } from './walletService';

export interface OrderItem {
  menu_item_id: string;
  name: string;
  price?: number;
  points_used?: number;
  quantity: number;
  pricing_type: 'points_only' | 'price_only' | 'price_with_points_discount';
}

export interface Order {
  id: string;
  order_number: string;
  restaurant_id: string;
  customer_id: string;
  branch_id: string;
  type: 'pickup' | 'delivery';
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'on_the_way' | 'completed' | 'cancelled';
  items: OrderItem[];
  subtotal: number;
  total_amount: number;
  total_points_used: number;
  payment_method: 'wallet' | 'cash_on_delivery' | 'card';
  payment_status: 'pending' | 'paid' | 'refunded';
  address_id?: string;
  delivery_address?: any;
  rider_id?: string;
  rider_assigned_at?: string;
  estimated_ready_time: number;
  accepted_at?: string;
  ready_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderParams {
  restaurant_id: string;
  customer_id: string;
  branch_id: string;
  type: 'pickup' | 'delivery';
  items: OrderItem[];
  subtotal: number;
  total_amount: number;
  total_points_used: number;
  payment_method: 'wallet' | 'cash_on_delivery' | 'card';
  address_id?: string;
  delivery_address?: any;
  notes?: string;
  estimated_ready_time?: number;
}

export class OrderService {
  static async getOrders(restaurantId: string, customerId?: string): Promise<Order[]> {
    try {
      let query = supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error getting orders:', error);
      return [];
    }
  }

  static async getOrder(orderId: string): Promise<Order | null> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error getting order:', error);
      return null;
    }
  }

  static async getOrdersByBranch(
    restaurantId: string,
    branchId: string,
    status?: string
  ): Promise<Order[]> {
    try {
      let query = supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error getting branch orders:', error);
      return [];
    }
  }

  static async createOrder(params: CreateOrderParams): Promise<Order> {
    try {
      const { data: orderNumber, error: numberError } = await supabase.rpc('generate_order_number');
      if (numberError) throw numberError;

      const orderData = {
        order_number: orderNumber,
        restaurant_id: params.restaurant_id,
        customer_id: params.customer_id,
        branch_id: params.branch_id,
        type: params.type,
        items: params.items,
        subtotal: params.subtotal,
        total_amount: params.total_amount,
        total_points_used: params.total_points_used,
        payment_method: params.payment_method,
        payment_status: 'pending',
        address_id: params.address_id,
        delivery_address: params.delivery_address,
        notes: params.notes,
        estimated_ready_time: params.estimated_ready_time || 20,
        status: 'pending',
      };

      const { data, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;

      if (params.payment_method === 'wallet' && params.total_amount > 0) {
        try {
          await WalletService.payWithWallet(
            params.restaurant_id,
            params.customer_id,
            params.total_amount,
            `Order ${orderNumber}`,
            'order',
            data.id,
            params.branch_id
          );

          await this.updateOrder(data.id, { payment_status: 'paid' });
        } catch (paymentError: any) {
          await this.cancelOrder(data.id, 'Payment failed: ' + paymentError.message);
          throw new Error('Payment failed: ' + paymentError.message);
        }
      }

      return data;
    } catch (error: any) {
      console.error('Error creating order:', error);
      throw new Error(error.message || 'Failed to create order');
    }
  }

  static async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error updating order:', error);
      return null;
    }
  }

  static async acceptOrder(orderId: string, estimatedTime?: number): Promise<Order | null> {
    try {
      const updates: any = {
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      };

      if (estimatedTime) {
        updates.estimated_ready_time = estimatedTime;
      }

      return await this.updateOrder(orderId, updates);
    } catch (error: any) {
      console.error('Error accepting order:', error);
      return null;
    }
  }

  static async markPreparing(orderId: string): Promise<Order | null> {
    return await this.updateOrder(orderId, { status: 'preparing' });
  }

  static async markReady(orderId: string): Promise<Order | null> {
    return await this.updateOrder(orderId, {
      status: 'ready',
      ready_at: new Date().toISOString(),
    });
  }

  static async markOnTheWay(orderId: string, riderId: string): Promise<Order | null> {
    return await this.updateOrder(orderId, {
      status: 'on_the_way',
      rider_id: riderId,
      rider_assigned_at: new Date().toISOString(),
    });
  }

  static async markCompleted(orderId: string): Promise<Order | null> {
    return await this.updateOrder(orderId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
  }

  static async cancelOrder(orderId: string, reason?: string): Promise<Order | null> {
    try {
      const order = await this.getOrder(orderId);
      if (!order) throw new Error('Order not found');

      if (order.payment_status === 'paid' && order.total_amount > 0) {
        await WalletService.refundToWallet(
          order.restaurant_id,
          order.customer_id,
          order.total_amount,
          `Refund for cancelled order ${order.order_number}`,
          'order',
          orderId,
          order.branch_id
        );
      }

      return await this.updateOrder(orderId, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        payment_status: order.payment_status === 'paid' ? 'refunded' : order.payment_status,
      });
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }

  static async assignRider(orderId: string, riderId: string): Promise<Order | null> {
    return await this.updateOrder(orderId, {
      rider_id: riderId,
      rider_assigned_at: new Date().toISOString(),
    });
  }

  static async getOrderMessages(orderId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('order_messages')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error getting order messages:', error);
      return [];
    }
  }

  static async sendOrderMessage(
    orderId: string,
    senderType: 'customer' | 'staff',
    senderId: string,
    message: string
  ): Promise<void> {
    try {
      const { error } = await supabase.from('order_messages').insert({
        order_id: orderId,
        sender_type: senderType,
        sender_id: senderId,
        message,
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Error sending order message:', error);
      throw new Error('Failed to send message');
    }
  }

  static canMessageOrder(order: Order): boolean {
    const orderAge = Date.now() - new Date(order.created_at).getTime();
    const tenMinutes = 10 * 60 * 1000;

    return (
      ['pending', 'accepted', 'preparing'].includes(order.status) &&
      orderAge >= tenMinutes
    );
  }
}
