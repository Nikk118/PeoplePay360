from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, date

# Auth Schemas
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    employee_id: Optional[str] = None
    roles: List[str]

class UserResponse(BaseModel):
    id: str
    email: str
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    is_active: bool
    roles: List[str]
    invitation_pending: bool = False
    invitation_link: Optional[str] = None
    email_sent: bool = True
    email_error: Optional[str] = None

class NewEmployeeCreateInput(BaseModel):
    first_name: str
    last_name: str
    employee_number: Optional[str] = None
    department_id: Optional[str] = None
    job_title: Optional[str] = None
    employee_type: str = "full_time"
    phone: Optional[str] = None

class UserCreate(BaseModel):
    email: str
    password: Optional[str] = None
    employee_id: Optional[str] = None
    roles: List[str]
    is_active: Optional[bool] = None
    new_employee: Optional[NewEmployeeCreateInput] = None

class UserLinkEmployee(BaseModel):
    employee_id: str

class ValidateInvitationResponse(BaseModel):
    valid: bool
    email: str
    employee_name: Optional[str] = None
    role: Optional[str] = None

class SetPasswordRequest(BaseModel):
    token: str
    password: str
    confirm_password: str

class SetPasswordResponse(BaseModel):
    success: bool
    message: str

class ResendInvitationResponse(BaseModel):
    success: bool
    message: str
    invitation_link: Optional[str] = None

# Department Schemas
class DepartmentResponse(BaseModel):
    id: str
    name: str
    created_at: datetime
    class Config:
        from_attributes = True

# Employee Schemas
class EmployeeBase(BaseModel):
    employee_number: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = None
    address: Optional[str] = None
    department_id: Optional[str] = None
    manager_id: Optional[str] = None
    job_title: Optional[str] = None
    job_position: Optional[str] = None
    employee_type: str = "full_time"
    working_schedule_id: Optional[str] = None
    status: str = "active"
    hire_date: Optional[date] = None
    bank_account_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_name: Optional[str] = None

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeResponse(EmployeeBase):
    id: str
    department_name: Optional[str] = None
    manager_name: Optional[str] = None
    schedule_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# Working Schedule Schemas
class ScheduleLineBase(BaseModel):
    day_of_week: int  # 0=Mon, 6=Sun
    start_time: str   # "09:00:00"
    end_time: str     # "17:30:00"
    break_duration_minutes: int = 0

class ScheduleLineCreate(ScheduleLineBase):
    pass

class ScheduleLineResponse(ScheduleLineBase):
    id: str
    class Config:
        from_attributes = True

class WorkingScheduleBase(BaseModel):
    name: str
    schedule_type: str = "standard"

class WorkingScheduleCreate(WorkingScheduleBase):
    lines: List[ScheduleLineCreate] = []

class WorkingScheduleResponse(WorkingScheduleBase):
    id: str
    lines: List[ScheduleLineResponse] = []
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# Contract Schemas
class ContractBase(BaseModel):
    employee_id: str
    name: str
    contract_type: Optional[str] = "permanent"
    department_id: Optional[str] = None
    job_position: Optional[str] = None
    job_title: Optional[str] = None
    date_start: date
    date_end: Optional[date] = None
    wage: float = 0.0
    wage_type: str = "monthly"
    salary_structure_id: Optional[str] = None
    working_schedule_id: Optional[str] = None
    status: str = "active"
    notes: Optional[str] = None

class ContractCreate(ContractBase):
    pass

class ContractResponse(ContractBase):
    id: str
    employee_name: Optional[str] = None
    department_name: Optional[str] = None
    salary_structure_name: Optional[str] = None
    schedule_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class ApplicableContractResponse(BaseModel):
    period_start: date
    period_end: date
    employee_id: str
    applicable_contract: Optional[ContractResponse] = None
    status_message: str

# Attendance Schemas
class CheckInRequest(BaseModel):
    employee_id: Optional[str] = None

class CheckOutRequest(BaseModel):
    attendance_id: str

class AttendanceCreate(BaseModel):
    employee_id: str
    check_in: datetime
    check_out: Optional[datetime] = None
    status: str = "present"
    is_manual_edit: bool = True
    notes: Optional[str] = None

class AttendanceUpdate(BaseModel):
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class AttendanceResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    employee_number: Optional[str] = None
    department_name: Optional[str] = None
    check_in: datetime
    check_out: Optional[datetime] = None
    worked_hours: float
    status: str
    is_manual_edit: bool
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class AttendanceSummaryResponse(BaseModel):
    total_records: int
    present_days: float
    late_days: float
    half_days: float
    absent_days: float
    total_worked_hours: float

# Time Off Schemas
class TimeOffTypeBase(BaseModel):
    name: str
    code: str
    unit: str = "days"
    requires_allocation: bool = True
    requires_approval: bool = True
    affects_payroll: bool = False
    color: str = "#3B82F6"
    active: bool = True

class TimeOffTypeCreate(TimeOffTypeBase):
    pass

class TimeOffTypeResponse(TimeOffTypeBase):
    id: str
    created_at: datetime
    class Config:
        from_attributes = True

class TimeOffAllocationCreate(BaseModel):
    employee_id: str
    time_off_type_id: str
    allocated_days: float
    date_from: date
    date_to: date
    notes: Optional[str] = None

class TimeOffAllocationResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    time_off_type_id: str
    time_off_type_name: Optional[str] = None
    allocated_days: float
    taken_days: float
    remaining_days: float
    date_from: date
    date_to: date
    status: str
    notes: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class TimeOffRequestCreate(BaseModel):
    employee_id: Optional[str] = None
    time_off_type_id: str
    date_from: date
    date_to: date
    reason: Optional[str] = None

class TimeOffRequestResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    time_off_type_id: str
    time_off_type_name: Optional[str] = None
    allocation_id: Optional[str] = None
    date_from: date
    date_to: date
    duration_days: float
    reason: Optional[str] = None
    status: str
    approved_by: Optional[str] = None
    approver_name: Optional[str] = None
    response_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class LeaveBalanceResponse(BaseModel):
    employee_id: str
    time_off_type_id: str
    type_name: str
    type_code: str
    allocated_days: float
    taken_days: float
    remaining_days: float
    requires_allocation: bool

# Salary Rule & Structure Schemas
class SalaryRuleBase(BaseModel):
    name: str
    code: str
    category: str = "allowance"  # basic, allowance, gross, deduction, net
    sequence: int = 10
    computation_type: str = "fixed"  # fixed, percentage, formula
    fixed_amount: float = 0.0
    percentage: float = 0.0
    percentage_base: Optional[str] = None
    formula: Optional[str] = None
    active: bool = True
    appears_on_payslip: bool = True

class SalaryRuleCreate(SalaryRuleBase):
    structure_id: Optional[str] = None

class SalaryRuleUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    category: Optional[str] = None
    sequence: Optional[int] = None
    computation_type: Optional[str] = None
    fixed_amount: Optional[float] = None
    percentage: Optional[float] = None
    percentage_base: Optional[str] = None
    formula: Optional[str] = None
    active: Optional[bool] = None
    appears_on_payslip: Optional[bool] = None

class SalaryRuleResponse(SalaryRuleBase):
    id: str
    structure_id: str
    created_at: datetime
    class Config:
        from_attributes = True

class SalaryStructureBase(BaseModel):
    name: str
    description: Optional[str] = None
    active: bool = True

class SalaryStructureCreate(SalaryStructureBase):
    rules: Optional[List[SalaryRuleCreate]] = []

class SalaryStructureUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None

class SalaryStructureResponse(SalaryStructureBase):
    id: str
    rule_count: int = 0
    rules: List[SalaryRuleResponse] = []
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# Payrun Schemas
class PayrunCreate(BaseModel):
    name: str
    salary_structure_id: str
    period_start: date
    period_end: date
    employee_ids: List[str]
    department_id: Optional[str] = None
    employee_type_filter: Optional[str] = None

class PayrunUpdate(BaseModel):
    name: Optional[str] = None

class PayslipUpdate(BaseModel):
    notes: Optional[str] = None

class PayrunEligibleEmployeeResponse(BaseModel):
    id: str
    employee_number: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    employee_type: str
    contract_id: Optional[str] = None
    contract_name: Optional[str] = None
    contract_status: Optional[str] = None
    has_applicable_contract: bool = True

class PayslipLineResponse(BaseModel):
    id: str
    salary_rule_id: str
    rule_name: str
    rule_code: str
    category: str
    sequence: int
    amount: float
    class Config:
        from_attributes = True

class PayslipResponse(BaseModel):
    id: str
    payrun_id: str
    employee_id: str
    employee_number: Optional[str] = None
    employee_name: Optional[str] = None
    department_name: Optional[str] = None
    contract_id: str
    contract_name: Optional[str] = None
    period_start: date
    period_end: date
    worked_days: float
    worked_hours: float
    basic_salary: float
    total_allowances: float
    gross_salary: float
    total_deductions: float
    net_salary: float
    status: str
    warnings: List[str] = []
    lines: List[PayslipLineResponse] = []
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class PayrunResponse(BaseModel):
    id: str
    name: str
    salary_structure_id: str
    salary_structure_name: Optional[str] = None
    period_start: date
    period_end: date
    status: str
    employee_type_filter: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    total_net: float
    total_gross: float
    payslip_count: int
    payslips: List[PayslipResponse] = []
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True


# Dashboard & Reports Schemas
class SelectedPeriodInfo(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    payrun_name: Optional[str] = None

class DashboardSummaryResponse(BaseModel):
    total_gross_salary: float = 0.0
    total_deductions: float = 0.0
    total_net_salary: float = 0.0
    total_basic_salary: float = 0.0
    total_allowances: float = 0.0
    payslip_count: int = 0
    employee_count: int = 0
    total_employees: int = 0
    selected_period: Optional[SelectedPeriodInfo] = None

class PayslipStatusCounts(BaseModel):
    draft: int = 0
    computed: int = 0
    validated: int = 0
    paid: int = 0
    total: int = 0

class SalaryByDepartmentItem(BaseModel):
    department_id: Optional[str] = None
    department_name: str
    total_gross: float = 0.0
    total_net: float = 0.0
    employee_count: int = 0

class PayrollTrendItem(BaseModel):
    payrun_id: Optional[str] = None
    payrun_name: str
    period_start: str
    period_end: str
    total_gross: float = 0.0
    total_net: float = 0.0
    total_deductions: float = 0.0
    payslip_count: int = 0
    status: str

class AttendanceSummaryResponse(BaseModel):
    total_records: int = 0
    present_records: int = 0
    absent_records: int = 0
    half_day_records: int = 0
    late_records: int = 0
    total_worked_hours: float = 0.0
    by_status: dict = {}

class TimeOffTypeSummaryItem(BaseModel):
    type_name: str
    code: str
    allocated: float = 0.0
    taken: float = 0.0

class TimeOffSummaryResponse(BaseModel):
    pending_requests: int = 0
    approved_requests: int = 0
    refused_requests: int = 0
    total_allocated_days: float = 0.0
    used_days: float = 0.0
    remaining_days: float = 0.0
    by_type: List[TimeOffTypeSummaryItem] = []

class DashboardWarningItem(BaseModel):
    category: str
    message: str
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    severity: str = "warning"

class DashboardOverviewResponse(BaseModel):
    summary: DashboardSummaryResponse
    payslip_status: PayslipStatusCounts
    salary_by_department: List[SalaryByDepartmentItem]
    payroll_trends: List[PayrollTrendItem]
    attendance: AttendanceSummaryResponse
    time_off: TimeOffSummaryResponse
    warnings: List[DashboardWarningItem]

