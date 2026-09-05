-- PeoplePay360 Seed Data for Demo Scenarios

-- 1. DEPARTMENTS
INSERT INTO departments (id, name) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Engineering'),
  ('22222222-2222-2222-2222-222222222222', 'Human Resources'),
  ('33333333-3333-3333-3333-333333333333', 'Sales & Marketing'),
  ('44444444-4444-4444-4444-444444444444', 'Finance')
ON CONFLICT (name) DO NOTHING;

-- 2. WORKING SCHEDULE
INSERT INTO working_schedules (id, name, schedule_type) VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Standard 40h (Mon-Fri)', 'standard')
ON CONFLICT (name) DO NOTHING;

INSERT INTO schedule_lines (id, schedule_id, day_of_week, start_time, end_time, break_duration_minutes) VALUES
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0, '09:00:00', '17:30:00', 30),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '09:00:00', '17:30:00', 30),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, '09:00:00', '17:30:00', 30),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3, '09:00:00', '17:30:00', 30),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 4, '09:00:00', '17:30:00', 30)
ON CONFLICT DO NOTHING;

-- 3. EMPLOYEES
INSERT INTO employees (id, employee_number, first_name, last_name, email, phone, gender, department_id, job_title, job_position, employee_type, working_schedule_id, status, hire_date, bank_account_name, bank_account_number, bank_name) VALUES
  ('e1111111-1111-1111-1111-111111111111', 'EMP001', 'Ravi', 'Kumar', 'ravi.kumar@peoplepay360.com', '+91 98765 43210', 'male', '11111111-1111-1111-1111-111111111111', 'Senior Software Engineer', 'Senior Developer', 'full_time', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active', '2023-01-15', 'Ravi Kumar', '987654321012', 'HDFC Bank'),
  ('e2222222-2222-2222-2222-222222222222', 'EMP002', 'Priya', 'Sharma', 'priya.sharma@peoplepay360.com', '+91 98765 43211', 'female', '22222222-2222-2222-2222-222222222222', 'HR Lead', 'HR Lead', 'full_time', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active', '2022-06-01', 'Priya Sharma', '987654321013', 'ICICI Bank'),
  ('e3333333-3333-3333-3333-333333333333', 'EMP003', 'Anita', 'Desai', 'anita.desai@peoplepay360.com', '+91 98765 43212', 'female', '33333333-3333-3333-3333-333333333333', 'Account Executive', 'Sales Specialist', 'full_time', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active', '2023-09-10', 'Anita Desai', '987654321014', 'State Bank of India'),
  ('e4444444-4444-4444-4444-444444444444', 'EMP004', 'Vikram', 'Patel', 'vikram.patel@peoplepay360.com', '+91 98765 43213', 'male', '44444444-4444-4444-4444-444444444444', 'Payroll Specialist', 'Payroll Specialist', 'full_time', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active', '2023-03-01', 'Vikram Patel', '987654321015', 'Axis Bank')
ON CONFLICT (employee_number) DO NOTHING;

-- Set Manager for Ravi
UPDATE employees SET manager_id = 'e2222222-2222-2222-2222-222222222222' WHERE id = 'e1111111-1111-1111-1111-111111111111';

-- 4. SALARY STRUCTURES
INSERT INTO salary_structures (id, name, description, active) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Regular Salary Structure', 'Standard salary structure for full-time employees including Basic, HRA, Allowances, PF, and Tax deductions', true)
ON CONFLICT (name) DO NOTHING;

-- 5. SALARY RULES
INSERT INTO salary_rules (id, structure_id, name, code, category, sequence, computation_type, fixed_amount, percentage, percentage_base, formula, active, appears_on_payslip) VALUES
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Basic Salary', 'BASIC', 'basic', 10, 'percentage', 0, 100.0, 'contract_wage', NULL, true, true),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'House Rent Allowance', 'HRA', 'allowance', 20, 'percentage', 0, 20.0, 'BASIC', NULL, true, true),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Meal Allowance', 'MA', 'allowance', 30, 'fixed', 2000.0, 0, NULL, NULL, true, true),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Transport Allowance', 'TA', 'allowance', 40, 'fixed', 1500.0, 0, NULL, NULL, true, true),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Gross Salary', 'GROSS', 'gross', 50, 'formula', 0, 0, NULL, 'BASIC + HRA + MA + TA', true, true),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Provident Fund', 'PF', 'deduction', 60, 'percentage', 0, -12.0, 'BASIC', NULL, true, true),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Income Tax', 'TAX', 'deduction', 70, 'formula', 0, 0, NULL, '-(GROSS * 0.10)', true, true),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Unpaid Leave Deduction', 'UPL', 'deduction', 80, 'formula', 0, 0, NULL, '-(time_off_unpaid_days * (BASIC / 22.0))', true, true),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Net Salary', 'NET', 'net', 90, 'formula', 0, 0, NULL, 'GROSS + PF + TAX + UPL', true, true)
ON CONFLICT DO NOTHING;

-- 6. CONTRACTS
INSERT INTO contracts (id, employee_id, name, contract_type, department_id, job_position, job_title, date_start, date_end, wage, wage_type, salary_structure_id, working_schedule_id, status) VALUES
  (gen_random_uuid(), 'e1111111-1111-1111-1111-111111111111', 'Ravi Kumar - Senior Dev Contract 2026', 'permanent', '11111111-1111-1111-1111-111111111111', 'Senior Developer', 'Senior Software Engineer', '2026-01-01', NULL, 60000.00, 'monthly', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active'),
  (gen_random_uuid(), 'e2222222-2222-2222-2222-222222222222', 'Priya Sharma - HR Lead Contract', 'permanent', '22222222-2222-2222-2222-222222222222', 'HR Lead', 'HR Lead', '2026-01-01', NULL, 75000.00, 'monthly', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active'),
  (gen_random_uuid(), 'e3333333-3333-3333-3333-333333333333', 'Anita Desai - Sales Specialist Contract', 'permanent', '33333333-3333-3333-3333-333333333333', 'Sales Specialist', 'Account Executive', '2026-01-01', NULL, 50000.00, 'monthly', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active'),
  (gen_random_uuid(), 'e4444444-4444-4444-4444-444444444444', 'Vikram Patel - Payroll Specialist Contract', 'permanent', '44444444-4444-4444-4444-444444444444', 'Payroll Specialist', 'Payroll Specialist', '2026-01-01', NULL, 55000.00, 'monthly', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active')
ON CONFLICT DO NOTHING;

-- 7. TIME OFF TYPES
INSERT INTO time_off_types (id, name, code, unit, requires_allocation, requires_approval, affects_payroll, color) VALUES
  ('t1111111-1111-1111-1111-111111111111', 'Paid Annual Leave', 'ANNUAL', 'days', true, true, false, '#10B981'),
  ('t2222222-2222-2222-2222-222222222222', 'Sick Leave', 'SICK', 'days', true, true, false, '#F59E0B'),
  ('t3333333-3333-3333-3333-333333333333', 'Unpaid Leave', 'UNPAID', 'days', false, true, true, '#EF4444')
ON CONFLICT (name) DO NOTHING;

-- 8. TIME OFF ALLOCATIONS
INSERT INTO time_off_allocations (id, employee_id, time_off_type_id, allocated_days, taken_days, date_from, date_to, status) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 't1111111-1111-1111-1111-111111111111', 20.0, 0.0, '2026-01-01', '2026-12-31', 'approved'),
  ('a2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 't1111111-1111-1111-1111-111111111111', 20.0, 0.0, '2026-01-01', '2026-12-31', 'approved'),
  ('a3333333-3333-3333-3333-333333333333', 'e3333333-3333-3333-3333-333333333333', 't1111111-1111-1111-1111-111111111111', 20.0, 0.0, '2026-01-01', '2026-12-31', 'approved')
ON CONFLICT DO NOTHING;

-- 9. USERS AND ROLES
-- Password for all test users is: Password123!
-- Hashed using bcrypt: $2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW
INSERT INTO app_users (id, employee_id, email, password_hash, is_active) VALUES
  ('u1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'employee@peoplepay360.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', true),
  ('u2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 'hrmanager@peoplepay360.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', true),
  ('u3333333-3333-3333-3333-333333333333', 'e4444444-4444-4444-4444-444444444444', 'payrollmanager@peoplepay360.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', true),
  ('u4444444-4444-4444-4444-444444444444', NULL, 'admin@peoplepay360.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role) VALUES
  ('u1111111-1111-1111-1111-111111111111', 'employee'),
  ('u2222222-2222-2222-2222-222222222222', 'hr_manager'),
  ('u3333333-3333-3333-3333-333333333333', 'hr_payroll_manager'),
  ('u4444444-4444-4444-4444-444444444444', 'admin')
ON CONFLICT DO NOTHING;
