-- Seed Data for PyX AutoCare Pro

-- Roles
INSERT INTO roles (id, name, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'owner', 'Shop owner with full access'),
  ('a0000000-0000-0000-0000-000000000002', 'service_advisor', 'Service advisor managing estimates and customers'),
  ('a0000000-0000-0000-0000-000000000003', 'technician', 'Technician performing repairs'),
  ('a0000000-0000-0000-0000-000000000004', 'cashier', 'Cashier handling billing and payments')
ON CONFLICT (name) DO NOTHING;

-- Demo Shop
INSERT INTO shops (id, shop_name, owner_name, contact_number, email, address) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Premier Auto Care', 'John Martinez', '+1-555-0100', 'info@premierautocare.com', '123 Main Street, Auto City, AC 12345')
ON CONFLICT DO NOTHING;

-- Demo Customers
INSERT INTO customers (id, shop_id, customer_number, full_name, contact_number, address, email) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'CUST-001', 'Michael Johnson', '+1-555-1001', '456 Oak Ave', 'michael.j@email.com'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'CUST-002', 'Sarah Williams', '+1-555-1002', '789 Pine St', 'sarah.w@email.com'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'CUST-003', 'David Brown', '+1-555-1003', '321 Elm Blvd', 'david.b@email.com')
ON CONFLICT DO NOTHING;

-- Demo Vehicles
INSERT INTO vehicles (id, shop_id, customer_id, plate_number, brand, unit, model, year_model, chassis_number, engine_number, color) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'ABC-1234', 'Toyota', 'Sedan', 'Camry', 2020, 'JT2BF28K0X0123456', 'ENG-001234', 'Silver'),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'XYZ-5678', 'Honda', 'SUV', 'CR-V', 2019, '2HKRM4H74KH123456', 'ENG-005678', 'Black'),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'DEF-9012', 'Ford', 'Truck', 'F-150', 2021, '1FTFW1E85MFA12345', 'ENG-009012', 'Blue')
ON CONFLICT DO NOTHING;

-- Demo Inventory
INSERT INTO inventory_items (id, shop_id, part_number, part_name, category, quantity, cost_price, selling_price, reorder_level, supplier) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'PART-001', 'Engine Oil 5W-30', 'Fluids', 50, 8.50, 15.00, 10, 'AutoParts Co'),
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'PART-002', 'Oil Filter', 'Filters', 30, 5.00, 12.00, 5, 'FilterMax'),
  ('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'PART-003', 'Brake Pads Front', 'Brakes', 20, 25.00, 55.00, 5, 'BrakePro'),
  ('e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'PART-004', 'Air Filter', 'Filters', 3, 10.00, 22.00, 5, 'FilterMax'),
  ('e0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'PART-005', 'Spark Plugs (Set of 4)', 'Ignition', 15, 20.00, 45.00, 3, 'IgniteParts')
ON CONFLICT DO NOTHING;

-- Demo Expenses
INSERT INTO expenses (shop_id, expense_date, category, description, amount) VALUES
  ('b0000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '5 days', 'electricity', 'Monthly electricity bill', 450.00),
  ('b0000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '3 days', 'rent', 'Shop rent - monthly', 2500.00),
  ('b0000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '1 day', 'shop_expenses', 'Cleaning supplies', 85.50),
  ('b0000000-0000-0000-0000-000000000001', CURRENT_DATE, 'internet', 'Internet service', 120.00)
ON CONFLICT DO NOTHING;
