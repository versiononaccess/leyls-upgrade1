/*
  # Wallet and Ordering System

  ## Overview
  Comprehensive system for wallet top-ups, menu ordering (pickup & delivery), 
  and order management with rider assignment.

  ## New Tables
  
  ### 1. wallet_transactions
  Tracks all wallet balance changes (top-ups, payments, refunds)
  - `id` (uuid, primary key)
  - `restaurant_id` (uuid, references restaurants)
  - `customer_id` (uuid, references customers)
  - `type` (text: 'top_up', 'payment', 'refund', 'adjustment')
  - `amount` (decimal, positive for credits, negative for debits)
  - `balance_after` (decimal, balance after transaction)
  - `description` (text)
  - `reference_type` (text, optional: 'order', 'qr_payment')
  - `reference_id` (uuid, optional)
  - `staff_id` (uuid, optional, who processed it)
  - `branch_id` (uuid, optional)
  - `created_at` (timestamptz)
  
  ### 2. customer_addresses
  Customer delivery addresses
  - `id` (uuid, primary key)
  - `restaurant_id` (uuid, references restaurants)
  - `customer_id` (uuid, references customers)
  - `label` (text: 'Home', 'Work', 'Other')
  - `address_line1` (text)
  - `address_line2` (text, optional)
  - `city` (text)
  - `area` (text, optional)
  - `building` (text, optional)
  - `floor` (text, optional)
  - `apartment` (text, optional)
  - `instructions` (text, optional)
  - `latitude` (decimal, optional)
  - `longitude` (decimal, optional)
  - `is_default` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 3. riders
  Delivery riders managed by restaurants
  - `id` (uuid, primary key)
  - `restaurant_id` (uuid, references restaurants)
  - `branch_id` (uuid, optional, references branches)
  - `name` (text)
  - `phone` (text)
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 4. orders
  Customer orders (pickup & delivery)
  - `id` (uuid, primary key)
  - `order_number` (text, unique, display ID)
  - `restaurant_id` (uuid, references restaurants)
  - `customer_id` (uuid, references customers)
  - `branch_id` (uuid, references branches)
  - `type` (text: 'pickup', 'delivery')
  - `status` (text: 'pending', 'accepted', 'preparing', 'ready', 'on_the_way', 'completed', 'cancelled')
  - `items` (jsonb, array of {menu_item_id, name, price, points_used, quantity})
  - `subtotal` (decimal)
  - `total_amount` (decimal)
  - `total_points_used` (integer, default 0)
  - `payment_method` (text: 'wallet', 'cash_on_delivery', 'card')
  - `payment_status` (text: 'pending', 'paid', 'refunded')
  - `address_id` (uuid, optional, references customer_addresses)
  - `delivery_address` (jsonb, optional, snapshot of address)
  - `rider_id` (uuid, optional, references riders)
  - `rider_assigned_at` (timestamptz, optional)
  - `estimated_ready_time` (integer, minutes)
  - `accepted_at` (timestamptz, optional)
  - `ready_at` (timestamptz, optional)
  - `completed_at` (timestamptz, optional)
  - `cancelled_at` (timestamptz, optional)
  - `cancellation_reason` (text, optional)
  - `notes` (text, optional)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 5. order_messages
  Customer-staff communication for orders
  - `id` (uuid, primary key)
  - `order_id` (uuid, references orders)
  - `sender_type` (text: 'customer', 'staff')
  - `sender_id` (uuid, customer_id or staff user_id)
  - `message` (text)
  - `created_at` (timestamptz)

  ## Modified Tables
  
  ### customers
  Add wallet_balance column
  - `wallet_balance` (decimal, default 0)
  
  ### menu_items  
  Add pricing configuration
  - `pricing_type` (text: 'points_only', 'price_only', 'price_with_points_discount')
  - `price` (decimal, nullable, for price_only and price_with_points_discount)
  - `points_discount_percent` (integer, nullable, for price_with_points_discount)

  ## Security
  - Enable RLS on all new tables
  - Customers can view/update their own addresses
  - Customers can view their own orders and wallet transactions
  - Staff can manage orders, riders, and wallet top-ups for their restaurant
  - Secure wallet balance updates through database functions only

  ## Functions
  - process_wallet_transaction: Atomically update wallet balance
  - generate_order_number: Generate unique order number
  - can_customer_afford_order: Check if customer has sufficient wallet balance
*/

-- Add wallet_balance to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'wallet_balance'
  ) THEN
    ALTER TABLE customers ADD COLUMN wallet_balance decimal DEFAULT 0 CHECK (wallet_balance >= 0);
  END IF;
END $$;

-- Add pricing fields to menu_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'pricing_type'
  ) THEN
    ALTER TABLE menu_items 
      ADD COLUMN pricing_type text DEFAULT 'points_only' CHECK (pricing_type IN ('points_only', 'price_only', 'price_with_points_discount')),
      ADD COLUMN price decimal,
      ADD COLUMN points_discount_percent integer CHECK (points_discount_percent >= 0 AND points_discount_percent <= 100);
  END IF;
END $$;

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('top_up', 'payment', 'refund', 'adjustment')),
  amount decimal NOT NULL,
  balance_after decimal NOT NULL,
  description text,
  reference_type text CHECK (reference_type IN ('order', 'qr_payment', 'manual')),
  reference_id uuid,
  staff_id uuid,
  branch_id uuid REFERENCES branches(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Create customer_addresses table
CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label text DEFAULT 'Home',
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  area text,
  building text,
  floor text,
  apartment text,
  instructions text,
  latitude decimal,
  longitude decimal,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

-- Create riders table
CREATE TABLE IF NOT EXISTS riders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id),
  name text NOT NULL,
  phone text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE riders ENABLE ROW LEVEL SECURITY;

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id),
  type text NOT NULL CHECK (type IN ('pickup', 'delivery')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'preparing', 'ready', 'on_the_way', 'completed', 'cancelled')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal decimal NOT NULL DEFAULT 0,
  total_amount decimal NOT NULL DEFAULT 0,
  total_points_used integer DEFAULT 0,
  payment_method text DEFAULT 'wallet' CHECK (payment_method IN ('wallet', 'cash_on_delivery', 'card')),
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  address_id uuid REFERENCES customer_addresses(id),
  delivery_address jsonb,
  rider_id uuid REFERENCES riders(id),
  rider_assigned_at timestamptz,
  estimated_ready_time integer DEFAULT 20,
  accepted_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create order_messages table
CREATE TABLE IF NOT EXISTS order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('customer', 'staff')),
  sender_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_customer ON wallet_transactions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_restaurant ON wallet_transactions(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_riders_restaurant ON riders(restaurant_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON orders(restaurant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_messages_order ON order_messages(order_id, created_at);

-- RLS Policies for wallet_transactions
CREATE POLICY "Customers can view own wallet transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Restaurant owners can view wallet transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant owners can create wallet transactions"
  ON wallet_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for customer_addresses
CREATE POLICY "Customers can view own addresses"
  ON customer_addresses FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Customers can insert own addresses"
  ON customer_addresses FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Customers can update own addresses"
  ON customer_addresses FOR UPDATE
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Customers can delete own addresses"
  ON customer_addresses FOR DELETE
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE email = auth.jwt()->>'email'
    )
  );

-- RLS Policies for riders
CREATE POLICY "Restaurant owners can manage riders"
  ON riders FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for orders
CREATE POLICY "Customers can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Customers can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Customers can update own orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Restaurant owners can view restaurant orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant owners can update restaurant orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for order_messages
CREATE POLICY "Order participants can view messages"
  ON order_messages FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders 
      WHERE customer_id IN (SELECT id FROM customers WHERE email = auth.jwt()->>'email')
         OR restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "Order participants can send messages"
  ON order_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    order_id IN (
      SELECT id FROM orders 
      WHERE customer_id IN (SELECT id FROM customers WHERE email = auth.jwt()->>'email')
         OR restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
    )
  );

-- Function to process wallet transaction atomically
CREATE OR REPLACE FUNCTION process_wallet_transaction(
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_type text,
  p_amount decimal,
  p_description text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_staff_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_current_balance decimal;
  v_new_balance decimal;
  v_transaction_id uuid;
BEGIN
  -- Lock the customer row for update
  SELECT wallet_balance INTO v_current_balance
  FROM customers
  WHERE id = p_customer_id AND restaurant_id = p_restaurant_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_current_balance + p_amount;
  
  -- Check for negative balance
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;
  
  -- Update customer wallet balance
  UPDATE customers
  SET wallet_balance = v_new_balance,
      updated_at = now()
  WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
  
  -- Insert wallet transaction record
  INSERT INTO wallet_transactions (
    restaurant_id,
    customer_id,
    type,
    amount,
    balance_after,
    description,
    reference_type,
    reference_id,
    staff_id,
    branch_id
  ) VALUES (
    p_restaurant_id,
    p_customer_id,
    p_type,
    p_amount,
    v_new_balance,
    p_description,
    p_reference_type,
    p_reference_id,
    p_staff_id,
    p_branch_id
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate unique order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text AS $$
DECLARE
  v_order_number text;
  v_exists boolean;
BEGIN
  LOOP
    -- Generate 6-digit random number with prefix
    v_order_number := 'ORD-' || LPAD(FLOOR(RANDOM() * 999999)::text, 6, '0');
    
    -- Check if it already exists
    SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = v_order_number) INTO v_exists;
    
    -- If unique, exit loop
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_order_number;
END;
$$ LANGUAGE plpgsql;

-- Function to check if customer can afford order
CREATE OR REPLACE FUNCTION can_customer_afford_order(
  p_customer_id uuid,
  p_restaurant_id uuid,
  p_order_amount decimal
) RETURNS boolean AS $$
DECLARE
  v_wallet_balance decimal;
BEGIN
  SELECT wallet_balance INTO v_wallet_balance
  FROM customers
  WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
  
  RETURN v_wallet_balance >= p_order_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_addresses_updated_at BEFORE UPDATE ON customer_addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_riders_updated_at BEFORE UPDATE ON riders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();