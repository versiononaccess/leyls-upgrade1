import React, { useState, useEffect } from 'react';
import {
  Package, Clock, CheckCircle, XCircle, Bike, User, MapPin,
  Phone, DollarSign, AlertCircle, RefreshCw, Search, Filter
} from 'lucide-react';
import { OrderService } from '../services/orderService';
import { RiderService } from '../services/riderService';

interface StaffOrderManagementProps {
  restaurantId: string;
  branchId: string;
}

interface Order {
  id: string;
  order_number: string;
  order_type: 'pickup' | 'delivery';
  status: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  customer: {
    first_name: string;
    last_name: string;
    phone?: string;
  };
  items: Array<{
    item_name: string;
    quantity: number;
    unit_price: number;
  }>;
  delivery_address?: {
    address_line1: string;
    address_line2?: string;
    city: string;
  };
  rider?: {
    name: string;
    phone: string;
  };
}

interface Rider {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
}

const StaffOrderManagement: React.FC<StaffOrderManagementProps> = ({ restaurantId, branchId }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [assignRiderModal, setAssignRiderModal] = useState<{ show: boolean; orderId: string | null }>({
    show: false,
    orderId: null
  });
  const [selectedRiderId, setSelectedRiderId] = useState('');

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 15000);
    return () => clearInterval(interval);
  }, [restaurantId, branchId]);

  const loadData = async (background = false) => {
    try {
      if (!background) setLoading(true);
      else setRefreshing(true);

      const [ordersData, ridersData] = await Promise.all([
        OrderService.getBranchOrders(branchId),
        RiderService.getBranchRiders(branchId)
      ]);

      setOrders(ordersData);
      setRiders(ridersData.filter(r => r.is_active));
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await OrderService.updateOrderStatus(orderId, newStatus);
      await loadData(true);
    } catch (err: any) {
      console.error('Error updating order status:', err);
      alert('Failed to update order status');
    }
  };

  const handleAssignRider = async () => {
    if (!assignRiderModal.orderId || !selectedRiderId) return;

    try {
      await OrderService.assignRider(assignRiderModal.orderId, selectedRiderId);
      setAssignRiderModal({ show: false, orderId: null });
      setSelectedRiderId('');
      await loadData(true);
    } catch (err: any) {
      console.error('Error assigning rider:', err);
      alert('Failed to assign rider');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order? The customer will be refunded.')) {
      return;
    }

    try {
      await OrderService.cancelOrder(orderId);
      await loadData(true);
    } catch (err: any) {
      console.error('Error cancelling order:', err);
      alert('Failed to cancel order');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-blue-100 text-blue-800';
      case 'preparing': return 'bg-orange-100 text-orange-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'out_for_delivery': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getNextStatus = (currentStatus: string, orderType: string) => {
    if (orderType === 'pickup') {
      switch (currentStatus) {
        case 'pending': return 'accepted';
        case 'accepted': return 'preparing';
        case 'preparing': return 'ready';
        case 'ready': return 'completed';
        default: return null;
      }
    } else {
      switch (currentStatus) {
        case 'pending': return 'accepted';
        case 'accepted': return 'preparing';
        case 'preparing': return 'ready';
        case 'ready': return 'out_for_delivery';
        case 'out_for_delivery': return 'completed';
        default: return null;
      }
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const filteredOrders = orders.filter(order => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesType = filterType === 'all' || order.order_type === filterType;
    const matchesSearch = !searchQuery ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${order.customer.first_name} ${order.customer.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesType && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Order Management</h2>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Orders Found</h3>
          <p className="text-gray-600">Orders will appear here when customers place them</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOrders.map(order => {
            const nextStatus = getNextStatus(order.status, order.order_type);

            return (
              <div key={order.id} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Order #{order.order_number}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-900">
                      {order.customer.first_name} {order.customer.last_name}
                    </span>
                  </div>

                  {order.customer.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-900">{order.customer.phone}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-900 capitalize">{order.order_type}</span>
                  </div>

                  {order.delivery_address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                      <span className="text-gray-900">
                        {order.delivery_address.address_line1}, {order.delivery_address.city}
                      </span>
                    </div>
                  )}

                  {order.rider && (
                    <div className="flex items-center gap-2 text-sm">
                      <Bike className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-900">{order.rider.name}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-3 mb-4">
                  <h4 className="font-medium text-gray-900 mb-2 text-sm">Items</h4>
                  <div className="space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.quantity}x {item.item_name}</span>
                        <span className="text-gray-900">{(item.unit_price * item.quantity).toFixed(2)} AED</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span>{order.total_amount.toFixed(2)} AED</span>
                  </div>
                </div>

                {order.status !== 'completed' && order.status !== 'cancelled' && (
                  <div className="flex gap-2">
                    {nextStatus && (
                      <button
                        onClick={() => handleStatusUpdate(order.id, nextStatus)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {getStatusLabel(nextStatus)}
                      </button>
                    )}

                    {order.order_type === 'delivery' && order.status === 'ready' && !order.rider && (
                      <button
                        onClick={() => setAssignRiderModal({ show: true, orderId: order.id })}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <Bike className="h-4 w-4" />
                        Assign Rider
                      </button>
                    )}

                    <button
                      onClick={() => handleCancelOrder(order.id)}
                      className="flex items-center justify-center gap-2 py-2 px-4 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {assignRiderModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Assign Rider</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Rider
              </label>
              <select
                value={selectedRiderId}
                onChange={(e) => setSelectedRiderId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a rider</option>
                {riders.map(rider => (
                  <option key={rider.id} value={rider.id}>
                    {rider.name} - {rider.phone}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setAssignRiderModal({ show: false, orderId: null });
                  setSelectedRiderId('');
                }}
                className="flex-1 py-2 px-4 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignRider}
                disabled={!selectedRiderId}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffOrderManagement;
