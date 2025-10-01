import React, { useState, useEffect } from 'react';
import { Bike, Plus, CreditCard as Edit3, Trash2, X, Save, Phone, User, CheckCircle, AlertCircle } from 'lucide-react';
import { RiderService } from '../services/riderService';

interface RiderManagementProps {
  branchId: string;
}

interface Rider {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
}

const RiderManagement: React.FC<RiderManagementProps> = ({ branchId }) => {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRider, setEditingRider] = useState<Rider | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRiders();
  }, [branchId]);

  const loadRiders = async () => {
    try {
      setLoading(true);
      const data = await RiderService.getBranchRiders(branchId);
      setRiders(data);
    } catch (err: any) {
      console.error('Error loading riders:', err);
      setError('Failed to load riders');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setFormLoading(true);
      setError('');

      if (editingRider) {
        await RiderService.updateRider(editingRider.id, formData);
      } else {
        await RiderService.createRider({
          branch_id: branchId,
          ...formData
        });
      }

      await loadRiders();
      setShowModal(false);
      setEditingRider(null);
      setFormData({ name: '', phone: '' });
    } catch (err: any) {
      console.error('Error saving rider:', err);
      setError(err.message || 'Failed to save rider');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (riderId: string) => {
    if (!confirm('Are you sure you want to delete this rider?')) {
      return;
    }

    try {
      await RiderService.deleteRider(riderId);
      await loadRiders();
    } catch (err: any) {
      console.error('Error deleting rider:', err);
      alert('Failed to delete rider');
    }
  };

  const handleToggleActive = async (riderId: string, currentStatus: boolean) => {
    try {
      await RiderService.updateRider(riderId, { is_active: !currentStatus });
      await loadRiders();
    } catch (err: any) {
      console.error('Error updating rider status:', err);
      alert('Failed to update rider status');
    }
  };

  const openEditModal = (rider: Rider) => {
    setEditingRider(rider);
    setFormData({ name: rider.name, phone: rider.phone });
    setShowModal(true);
    setError('');
  };

  const openCreateModal = () => {
    setEditingRider(null);
    setFormData({ name: '', phone: '' });
    setShowModal(true);
    setError('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Delivery Riders</h2>
          <p className="text-sm text-gray-600 mt-1">Manage riders for delivery orders</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Rider
        </button>
      </div>

      {riders.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
          <Bike className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Riders Added</h3>
          <p className="text-gray-600 mb-4">Add riders to handle delivery orders</p>
          <button
            onClick={openCreateModal}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Your First Rider
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {riders.map(rider => (
            <div key={rider.id} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Bike className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{rider.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Phone className="h-3 w-3 text-gray-500" />
                      <p className="text-sm text-gray-600">{rider.phone}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                  rider.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {rider.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(rider)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleToggleActive(rider.id, rider.is_active)}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                    rider.is_active
                      ? 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                      : 'text-green-700 bg-green-50 hover:bg-green-100'
                  }`}
                >
                  {rider.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(rider.id)}
                  className="py-2 px-3 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">
                {editingRider ? 'Edit Rider' : 'Add New Rider'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingRider(null);
                  setFormData({ name: '', phone: '' });
                  setError('');
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rider Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter rider name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter phone number"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingRider(null);
                  setFormData({ name: '', phone: '' });
                  setError('');
                }}
                className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={formLoading}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {formLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {editingRider ? 'Update Rider' : 'Add Rider'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiderManagement;
