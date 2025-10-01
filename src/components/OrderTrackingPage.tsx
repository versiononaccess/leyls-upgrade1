import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, Package, Bike, XCircle, MessageSquare, RefreshCw, MapPin } from 'lucide-react';
import { OrderService } from '../services/orderService';

interface OrderTrackingPageProps {
  customerId: string;
  restaurantId: string;
}

interface Order {
  id: string;
  order_number: string;
  order_type: 'pickup' | 'delivery';
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled';
  total_amount: number;
  payment_method: string;
  created_at: string;
  items: Array<{
    item_name: string;
    quantity: number;
    unit_price: number;
  }>;
  delivery_address?: {
    address_line1: string;
    city: string;
  };
}

const OrderTrackingPage: React.FC<OrderTrackingPageProps> = ({ customerId, restaurantId }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [customerId, restaurantId]);

  const loadOrders = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const data = await OrderService.getCustomerOrders(customerId);
      setOrders(data);
    } catch (err: any) {
      console.error('Error loading orders:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { icon: Clock, label: 'Pending', color: 'text-yellow-600 bg-yellow-50' };
      case 'accepted':
        return { icon: CheckCircle, label: 'Accepted', color: 'text-blue-600 bg-blue-50' };
      case 'preparing':
        return { icon: Package, label: 'Preparing', color: 'text-orange-600 bg-orange-50' };
      case 'ready':
        return { icon: CheckCircle, label: 'Ready', color: 'text-green-600 bg-green-50' };
      case 'out_for_delivery':
        return { icon: Bike, label: 'Out for Delivery', color: 'text-purple-600 bg-purple-50' };
      case 'completed':
        return { icon: CheckCircle, label: 'Completed', color: 'text-green-600 bg-green-50' };
      case 'cancelled':
        return { icon: XCircle, label: 'Cancelled', color: 'text-red-600 bg-red-50' };
      default:
        return { icon: Clock, label: status, color: 'text-gray-600 bg-gray-50' };
    }
  };

  const getOrderProgress = (status: string, orderType: string) => {
    const pickupSteps = ['pending', 'accepted', 'preparing', 'ready', 'completed'];
    const deliverySteps = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed'];

    const steps = orderType === 'delivery' ? deliverySteps : pickupSteps;
    const currentIndex = steps.indexOf(status);
    const progress = currentIndex >= 0 ? ((currentIndex + 1) / steps.length) * 100 : 0;

    return { progress, steps, currentIndex };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
        <button
          onClick={() => loadOrders(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Orders Yet</h3>
          <p className="text-gray-600">Your order history will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const statusInfo = getStatusInfo(order.status);
            const { progress, steps, currentIndex } = getOrderProgress(order.status, order.order_type);
            const StatusIcon = statusInfo.icon;

            return (
              <div key={order.id} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">Order #{order.order_number}</h3>
                      <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                        <StatusIcon className="h-4 w-4" />
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{order.total_amount.toFixed(2)} AED</p>
                    <p className="text-sm text-gray-600 capitalize">{order.order_type}</p>
                  </div>
                </div>

                {order.status !== 'cancelled' && order.status !== 'completed' && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2 text-sm text-gray-600">
                      <span>Order Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      {steps.map((step, idx) => (
                        <span
                          key={step}
                          className={idx <= currentIndex ? 'text-blue-600 font-medium' : ''}
                        >
                          {step.charAt(0).toUpperCase() + step.slice(1).replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {order.delivery_address && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Delivery Address</p>
                      <p className="text-sm text-gray-600">
                        {order.delivery_address.address_line1}, {order.delivery_address.city}
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">Order Items</h4>
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          {item.quantity}x {item.item_name}
                        </span>
                        <span className="text-gray-900 font-medium">
                          {(item.unit_price * item.quantity).toFixed(2)} AED
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {order.status !== 'completed' && order.status !== 'cancelled' && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">
                      <MessageSquare className="h-4 w-4" />
                      Contact Support
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrderTrackingPage;
