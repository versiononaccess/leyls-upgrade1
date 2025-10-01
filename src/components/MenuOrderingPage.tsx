import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, MapPin, Store, Bike, AlertCircle, CheckCircle, Zap, DollarSign, X } from 'lucide-react';
import { MenuItemService, MenuItem } from '../services/menuItemService';
import { OrderService } from '../services/orderService';
import { AddressService } from '../services/addressService';
import { WalletService } from '../services/walletService';

interface MenuOrderingPageProps {
  restaurantId: string;
  customerId: string;
  branchId?: string;
  onOrderComplete?: () => void;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

interface CustomerAddress {
  id: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  area?: string;
  is_default: boolean;
}

const MenuOrderingPage: React.FC<MenuOrderingPageProps> = ({
  restaurantId,
  customerId,
  branchId,
  onOrderComplete
}) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'pickup' | 'delivery'>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<'wallet_balance' | 'wallet_points'>('wallet_balance');
  const [selectedAddress, setSelectedAddress] = useState<CustomerAddress | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { value: 'all', label: 'All Items' },
    { value: 'main', label: 'Main Course' },
    { value: 'beverage', label: 'Beverages' },
    { value: 'salad', label: 'Salads' },
    { value: 'dessert', label: 'Desserts' },
    { value: 'appetizer', label: 'Appetizers' }
  ];

  useEffect(() => {
    loadData();
  }, [restaurantId, customerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [items, addressesData, balance] = await Promise.all([
        MenuItemService.getMenuItems(restaurantId),
        AddressService.getCustomerAddresses(customerId),
        WalletService.getWalletBalance(customerId)
      ]);

      setMenuItems(items.filter(item => item.is_active));
      setAddresses(addressesData);
      setWalletBalance(balance);

      const defaultAddress = addressesData.find(addr => addr.is_default);
      if (defaultAddress) {
        setSelectedAddress(defaultAddress);
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError('Failed to load menu data');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (item: MenuItem) => {
    const existingItem = cart.find(ci => ci.menuItem.id === item.id);
    if (existingItem) {
      setCart(cart.map(ci =>
        ci.menuItem.id === item.id
          ? { ...ci, quantity: ci.quantity + 1 }
          : ci
      ));
    } else {
      setCart([...cart, { menuItem: item, quantity: 1 }]);
    }
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter(ci => ci.menuItem.id !== itemId));
    } else {
      setCart(cart.map(ci =>
        ci.menuItem.id === itemId
          ? { ...ci, quantity }
          : ci
      ));
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(ci => ci.menuItem.id !== itemId));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => {
      const itemPrice = getItemPrice(item.menuItem);
      return total + (itemPrice * item.quantity);
    }, 0);
  };

  const getItemPrice = (item: MenuItem): number => {
    if (item.pricing_type === 'price_only') {
      return item.price || 0;
    } else if (item.pricing_type === 'points_only') {
      return 0;
    } else if (item.pricing_type === 'hybrid') {
      if (paymentMethod === 'wallet_points' && item.points_discount_percent) {
        return (item.price || 0) * (1 - item.points_discount_percent / 100);
      }
      return item.price || 0;
    }
    return item.price || 0;
  };

  const canAffordOrder = () => {
    const total = calculateTotal();
    return walletBalance >= total;
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      setError('Your cart is empty');
      return;
    }

    if (orderType === 'delivery' && !selectedAddress) {
      setError('Please select a delivery address');
      return;
    }

    if (!canAffordOrder()) {
      setError('Insufficient wallet balance');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const orderItems = cart.map(ci => ({
        menu_item_id: ci.menuItem.id,
        quantity: ci.quantity,
        unit_price: getItemPrice(ci.menuItem),
        item_name: ci.menuItem.name
      }));

      await OrderService.createOrder({
        restaurant_id: restaurantId,
        customer_id: customerId,
        branch_id: branchId,
        order_type: orderType,
        payment_method: paymentMethod,
        items: orderItems,
        delivery_address_id: orderType === 'delivery' ? selectedAddress?.id : undefined,
        total_amount: calculateTotal()
      });

      setCart([]);
      await loadData();

      if (onOrderComplete) {
        onOrderComplete();
      }
    } catch (err: any) {
      console.error('Error submitting order:', err);
      setError(err.message || 'Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = selectedCategory === 'all'
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Order Menu</h1>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    selectedCategory === cat.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-gray-600">{item.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div>
                    {item.pricing_type === 'price_only' && (
                      <span className="text-lg font-bold text-gray-900">{item.price} AED</span>
                    )}
                    {item.pricing_type === 'points_only' && (
                      <span className="text-lg font-bold text-blue-600 flex items-center gap-1">
                        <Zap className="h-4 w-4" />
                        Points Only
                      </span>
                    )}
                    {item.pricing_type === 'hybrid' && (
                      <div className="text-sm">
                        <div className="font-bold text-gray-900">{item.price} AED</div>
                        {paymentMethod === 'wallet_points' && item.points_discount_percent && (
                          <div className="text-green-600 text-xs">
                            {item.points_discount_percent}% off with points
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => addToCart(item)}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl p-6 border border-gray-200 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Your Cart
              </h2>
              <span className="text-sm text-gray-600">{cart.length} items</span>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Order Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOrderType('pickup')}
                  className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg border-2 transition-all ${
                    orderType === 'pickup'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Store className="h-4 w-4" />
                  Pickup
                </button>
                <button
                  onClick={() => setOrderType('delivery')}
                  className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg border-2 transition-all ${
                    orderType === 'delivery'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Bike className="h-4 w-4" />
                  Delivery
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod('wallet_balance')}
                  className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg border-2 transition-all ${
                    paymentMethod === 'wallet_balance'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <DollarSign className="h-4 w-4" />
                  Cash
                </button>
                <button
                  onClick={() => setPaymentMethod('wallet_points')}
                  className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg border-2 transition-all ${
                    paymentMethod === 'wallet_points'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Zap className="h-4 w-4" />
                  Points
                </button>
              </div>
            </div>

            {orderType === 'delivery' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Address</label>
                {addresses.length > 0 ? (
                  <select
                    value={selectedAddress?.id || ''}
                    onChange={(e) => {
                      const addr = addresses.find(a => a.id === e.target.value);
                      setSelectedAddress(addr || null);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select address</option>
                    {addresses.map(addr => (
                      <option key={addr.id} value={addr.id}>
                        {addr.address_line1}, {addr.city}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-600">No addresses found. Please add one first.</p>
                )}
              </div>
            )}

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Wallet Balance:</span>
                <span className="font-semibold text-gray-900">{walletBalance.toFixed(2)} AED</span>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Your cart is empty</p>
              ) : (
                cart.map(item => (
                  <div key={item.menuItem.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.menuItem.name}</p>
                      <p className="text-sm text-gray-600">{getItemPrice(item.menuItem).toFixed(2)} AED each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                        className="p-1 text-gray-600 hover:text-gray-900"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                        className="p-1 text-gray-600 hover:text-gray-900"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.menuItem.id)}
                        className="p-1 text-red-600 hover:text-red-700 ml-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-gray-200 pt-4 mb-4">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>{calculateTotal().toFixed(2)} AED</span>
              </div>
            </div>

            <button
              onClick={handleSubmitOrder}
              disabled={submitting || cart.length === 0 || !canAffordOrder()}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Placing Order...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Place Order
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuOrderingPage;
