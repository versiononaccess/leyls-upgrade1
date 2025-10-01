import { supabase } from '../lib/supabase';

export interface Rider {
  id: string;
  restaurant_id: string;
  branch_id?: string;
  name: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RiderInsert {
  restaurant_id: string;
  branch_id?: string;
  name: string;
  phone: string;
  is_active?: boolean;
}

export interface RiderUpdate {
  name?: string;
  phone?: string;
  branch_id?: string;
  is_active?: boolean;
}

export class RiderService {
  static async getRiders(restaurantId: string, branchId?: string): Promise<Rider[]> {
    try {
      let query = supabase
        .from('riders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name', { ascending: true });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error getting riders:', error);
      return [];
    }
  }

  static async getActiveRiders(restaurantId: string, branchId?: string): Promise<Rider[]> {
    try {
      let query = supabase
        .from('riders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error getting active riders:', error);
      return [];
    }
  }

  static async getRider(riderId: string): Promise<Rider | null> {
    try {
      const { data, error } = await supabase
        .from('riders')
        .select('*')
        .eq('id', riderId)
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error getting rider:', error);
      return null;
    }
  }

  static async createRider(riderData: RiderInsert): Promise<Rider> {
    try {
      const { data, error } = await supabase
        .from('riders')
        .insert(riderData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error creating rider:', error);
      throw new Error(error.message || 'Failed to create rider');
    }
  }

  static async updateRider(riderId: string, updates: RiderUpdate): Promise<Rider | null> {
    try {
      const { data, error } = await supabase
        .from('riders')
        .update(updates)
        .eq('id', riderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error updating rider:', error);
      return null;
    }
  }

  static async deleteRider(riderId: string): Promise<void> {
    try {
      const { error } = await supabase.from('riders').delete().eq('id', riderId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting rider:', error);
      throw new Error(error.message || 'Failed to delete rider');
    }
  }

  static async toggleRiderStatus(riderId: string): Promise<Rider | null> {
    try {
      const rider = await this.getRider(riderId);
      if (!rider) return null;

      return await this.updateRider(riderId, { is_active: !rider.is_active });
    } catch (error: any) {
      console.error('Error toggling rider status:', error);
      return null;
    }
  }
}
