-- PeoplePay360 Integrated HR & Payroll Schema (PostgreSQL / Supabase)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DEPARTMENTS
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. WORKING SCHEDULES
CREATE TABLE IF NOT EXISTS working_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    schedule_type VARCHAR(20) NOT NULL DEFAULT 'standard',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SCHEDULE LINES
CREATE TABLE IF NOT EXISTS schedule_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES working_schedules(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_duration_minutes INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT idx_schedule_day UNIQUE (schedule_id, day_of_week)
);

-- 4. EMPLOYEES
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_number VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    marital_status VARCHAR(20),
    nationality VARCHAR(50),
    address TEXT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    job_title VARCHAR(100),
    job_position VARCHAR(100),
    employee_type VARCHAR(20) NOT NULL CHECK (employee_type IN ('full_time', 'part_time', 'contract', 'intern')),
    working_schedule_id UUID REFERENCES working_schedules(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    hire_date DATE,
    bank_account_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);

-- 5. SALARY STRUCTURES
CREATE TABLE IF NOT EXISTS salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. SALARY RULES
CREATE TABLE IF NOT EXISTS salary_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    structure_id UUID NOT NULL REFERENCES salary_structures(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(30) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('basic', 'allowance', 'gross', 'deduction', 'net')),
    sequence INTEGER NOT NULL,
    computation_type VARCHAR(20) NOT NULL CHECK (computation_type IN ('fixed', 'percentage', 'formula')),
    fixed_amount NUMERIC(12,2) DEFAULT 0,
    percentage NUMERIC(5,2) DEFAULT 0,
    percentage_base VARCHAR(30),
    formula TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    appears_on_payslip BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT idx_struct_rule_code UNIQUE (structure_id, code),
    CONSTRAINT idx_struct_rule_seq UNIQUE (structure_id, sequence)
);

-- 7. CONTRACTS
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    contract_type VARCHAR(20) CHECK (contract_type IN ('permanent', 'fixed_term', 'internship')),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    job_position VARCHAR(100),
    job_title VARCHAR(100),
    date_start DATE NOT NULL,
    date_end DATE,
    wage NUMERIC(12,2) NOT NULL DEFAULT 0,
    wage_type VARCHAR(10) NOT NULL DEFAULT 'monthly' CHECK (wage_type IN ('monthly', 'hourly')),
    salary_structure_id UUID REFERENCES salary_structures(id) ON DELETE SET NULL,
    working_schedule_id UUID REFERENCES working_schedules(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expired', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_emp ON contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_contracts_dates ON contracts(employee_id, date_start, date_end);

-- 8. ATTENDANCE
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    check_in TIMESTAMPTZ NOT NULL,
    check_out TIMESTAMPTZ,
    worked_hours NUMERIC(5,2) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent', 'half_day')),
    is_manual_edit BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_emp_in ON attendance(employee_id, check_in);

-- 9. TIME OFF TYPES
CREATE TABLE IF NOT EXISTS time_off_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    unit VARCHAR(10) NOT NULL DEFAULT 'days' CHECK (unit IN ('days', 'hours')),
    requires_allocation BOOLEAN NOT NULL DEFAULT TRUE,
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    affects_payroll BOOLEAN NOT NULL DEFAULT FALSE,
    color VARCHAR(7) DEFAULT '#3B82F6',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. TIME OFF ALLOCATIONS
CREATE TABLE IF NOT EXISTS time_off_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    time_off_type_id UUID NOT NULL REFERENCES time_off_types(id) ON DELETE CASCADE,
    allocated_days NUMERIC(5,1) NOT NULL DEFAULT 0,
    taken_days NUMERIC(5,1) NOT NULL DEFAULT 0,
    remaining_days NUMERIC(5,1) GENERATED ALWAYS AS (allocated_days - taken_days) STORED,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'refused')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. TIME OFF REQUESTS
CREATE TABLE IF NOT EXISTS time_off_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    time_off_type_id UUID NOT NULL REFERENCES time_off_types(id) ON DELETE CASCADE,
    allocation_id UUID REFERENCES time_off_allocations(id) ON DELETE SET NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    duration_days NUMERIC(5,1) NOT NULL DEFAULT 0,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'refused', 'cancelled')),
    approved_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    response_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeoff_req_emp ON time_off_requests(employee_id);

-- 12. PAYRUNS
CREATE TABLE IF NOT EXISTS payruns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    salary_structure_id UUID NOT NULL REFERENCES salary_structures(id) ON DELETE RESTRICT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'computed', 'validated', 'paid')),
    employee_type_filter VARCHAR(20),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    total_net NUMERIC(14,2) DEFAULT 0,
    total_gross NUMERIC(14,2) DEFAULT 0,
    payslip_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. PAYSLIPS
CREATE TABLE IF NOT EXISTS payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payrun_id UUID NOT NULL REFERENCES payruns(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    worked_days NUMERIC(5,1) DEFAULT 0,
    worked_hours NUMERIC(6,2) DEFAULT 0,
    basic_salary NUMERIC(12,2) DEFAULT 0,
    total_allowances NUMERIC(12,2) DEFAULT 0,
    gross_salary NUMERIC(12,2) DEFAULT 0,
    total_deductions NUMERIC(12,2) DEFAULT 0,
    net_salary NUMERIC(12,2) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'computed', 'validated', 'paid')),
    warnings JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT idx_payrun_emp_unique UNIQUE (payrun_id, employee_id)
);

-- 14. PAYSLIP LINES
CREATE TABLE IF NOT EXISTS payslip_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payslip_id UUID NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
    salary_rule_id UUID NOT NULL REFERENCES salary_rules(id) ON DELETE RESTRICT,
    rule_name VARCHAR(100) NOT NULL,
    rule_code VARCHAR(30) NOT NULL,
    category VARCHAR(20) NOT NULL,
    sequence INTEGER NOT NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- 15. APP USERS & ROLES
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID UNIQUE REFERENCES employees(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL CHECK (role IN ('employee', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin')),
    CONSTRAINT idx_user_role UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_token_hash ON user_invitations(token_hash);

