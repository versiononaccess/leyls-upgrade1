import { supabase } from '../lib/supabase';

export interface CustomerAddress {
  id: string;
  restaurant_id: string;
  customer_id: string;
  label: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  area?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  instructions?: string;
  latitude?: number;
  longitude?: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddressInsert {
  restaurant_id: string;
  customer_id: string;
  label: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  area?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  instructions?: string;
  latitude?: number;
  longitude?: number;
  is_default?: boolean;
}

export interface AddressUpdate {
  label?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  area?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  instructions?: string;
  latitude?: number;
  longitude?: number;
  is_default?: boolean;
}

export class AddressService {
  static async getAddresses(restaurantId: string, customerId: string): Promise<CustomerAddress[]> {
    try {
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('customer_id', customerId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error getting addresses:', error);
      return [];
    }
  }

  static async getAddress(addressId: string): Promise<CustomerAddress | null> {
    try {
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('id', addressId)
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error getting address:', error);
      return null;
    }
  }

  static async getDefaultAddress(
    restaurantId: string,
    customerId: string
  ): Promise<CustomerAddress | null> {
    try {
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('customer_id', customerId)
        .eq('is_default', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error getting default address:', error);
      return null;
    }
  }

  static async createAddress(addressData: AddressInsert): Promise<CustomerAddress> {
    try {
      if (addressData.is_default) {
        await this.unsetAllDefaults(addressData.restaurant_id, addressData.customer_id);
      }

      const { data, error } = await supabase
        .from('customer_addresses')
        .insert(addressData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error creating address:', error);
      throw new Error(error.message || 'Failed to create address');
    }
  }

  static async updateAddress(
    addressId: string,
    updates: AddressUpdate
  ): Promise<CustomerAddress | null> {
    try {
      if (updates.is_default) {
        const address = await this.getAddress(addressId);
        if (address) {
          await this.unsetAllDefaults(address.restaurant_id, address.customer_id);
        }
      }

      const { data, error } = await supabase
        .from('customer_addresses')
        .update(updates)
        .eq('id', addressId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error updating address:', error);
      return null;
    }
  }

  static async deleteAddress(addressId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('customer_addresses')
        .delete()
        .eq('id', addressId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting address:', error);
      throw new Error(error.message || 'Failed to delete address');
    }
  }

  static async setDefaultAddress(addressId: string): Promise<CustomerAddress | null> {
    const address = await this.getAddress(addressId);
    if (!address) return null;

    await this.unsetAllDefaults(address.restaurant_id, address.customer_id);

    return await this.updateAddress(addressId, { is_default: true });
  }

  private static async unsetAllDefaults(restaurantId: string, customerId: string): Promise<void> {
    try {
      await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('restaurant_id', restaurantId)
        .eq('customer_id', customerId)
        .eq('is_default', true);
    } catch (error: any) {
      console.error('Error unsetting defaults:', error);
    }
  }

  static formatAddress(address: CustomerAddress): string {
    const parts = [address.address_line1];

    if (address.building) parts.push(`Building ${address.building}`);
    if (address.floor) parts.push(`Floor ${address.floor}`);
    if (address.apartment) parts.push(`Apt ${address.apartment}`);
    if (address.area) parts.push(address.area);
    parts.push(address.city);

    return parts.join(', ');
  }
}
