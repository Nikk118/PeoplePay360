import uuid
from datetime import datetime, date, time
from typing import List, Optional
from sqlalchemy import (
    Column, String, Boolean, Integer, Float, Numeric, Date, Time, DateTime, Text,
    ForeignKey, Table, CheckConstraint, UniqueConstraint
)
from sqlalchemy.orm import relationship, Mapped
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Department(Base):
    __tablename__ = "departments"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employees = relationship("Employee", back_populates="department", foreign_keys="Employee.department_id")

class WorkingSchedule(Base):
    __tablename__ = "working_schedules"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False, unique=True)
    schedule_type = Column(String(20), default="standard")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lines = relationship("ScheduleLine", back_populates="schedule", cascade="all, delete-orphan")

class ScheduleLine(Base):
    __tablename__ = "schedule_lines"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    schedule_id = Column(String(36), ForeignKey("working_schedules.id", ondelete="CASCADE"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Mon, 6=Sun
    start_time = Column(String(10), nullable=False)  # "09:00:00"
    end_time = Column(String(10), nullable=False)    # "17:30:00"
    break_duration_minutes = Column(Integer, default=0)

    schedule = relationship("WorkingSchedule", back_populates="lines")

class Employee(Base):
    __tablename__ = "employees"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    employee_number = Column(String(20), nullable=False, unique=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    phone = Column(String(20), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(10), nullable=True)
    marital_status = Column(String(20), nullable=True)
    nationality = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    department_id = Column(String(36), ForeignKey("departments.id"), nullable=True)
    manager_id = Column(String(36), ForeignKey("employees.id"), nullable=True)
    job_title = Column(String(100), nullable=True)
    job_position = Column(String(100), nullable=True)
    employee_type = Column(String(20), nullable=False, default="full_time")  # full_time, part_time, contract, intern
    working_schedule_id = Column(String(36), ForeignKey("working_schedules.id"), nullable=True)
    status = Column(String(20), nullable=False, default="active")  # active, inactive, archived
    hire_date = Column(Date, nullable=True)
    bank_account_name = Column(String(100), nullable=True)
    bank_account_number = Column(String(50), nullable=True)
    bank_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    department = relationship("Department", back_populates="employees", foreign_keys=[department_id])
    manager = relationship("Employee", remote_side=[id], foreign_keys=[manager_id])
    schedule = relationship("WorkingSchedule")
    contracts = relationship("Contract", back_populates="employee", cascade="all, delete-orphan")
    attendance = relationship("Attendance", back_populates="employee", cascade="all, delete-orphan")
    time_off_allocations = relationship("TimeOffAllocation", back_populates="employee", cascade="all, delete-orphan")
    time_off_requests = relationship("TimeOffRequest", back_populates="employee", foreign_keys="TimeOffRequest.employee_id", cascade="all, delete-orphan")

class SalaryStructure(Base):
    __tablename__ = "salary_structures"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    rules = relationship("SalaryRule", back_populates="structure", order_by="SalaryRule.sequence", cascade="all, delete-orphan")

class SalaryRule(Base):
    __tablename__ = "salary_rules"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    structure_id = Column(String(36), ForeignKey("salary_structures.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(30), nullable=False)
    category = Column(String(20), nullable=False)  # basic, allowance, gross, deduction, net
    sequence = Column(Integer, nullable=False)
    computation_type = Column(String(20), nullable=False)  # fixed, percentage, formula
    fixed_amount = Column(Float, default=0.0)
    percentage = Column(Float, default=0.0)
    percentage_base = Column(String(30), nullable=True)
    formula = Column(Text, nullable=True)
    active = Column(Boolean, default=True)
    appears_on_payslip = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    structure = relationship("SalaryStructure", back_populates="rules")

class Contract(Base):
    __tablename__ = "contracts"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    contract_type = Column(String(20), nullable=True)  # permanent, fixed_term, internship
    department_id = Column(String(36), ForeignKey("departments.id"), nullable=True)
    job_position = Column(String(100), nullable=True)
    job_title = Column(String(100), nullable=True)
    date_start = Column(Date, nullable=False)
    date_end = Column(Date, nullable=True)
    wage = Column(Float, nullable=False, default=0.0)
    wage_type = Column(String(10), default="monthly")
    salary_structure_id = Column(String(36), ForeignKey("salary_structures.id"), nullable=True)
    working_schedule_id = Column(String(36), ForeignKey("working_schedules.id"), nullable=True)
    status = Column(String(20), default="active")  # draft, active, expired, cancelled
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("Employee", back_populates="contracts")
    salary_structure = relationship("SalaryStructure")
    schedule = relationship("WorkingSchedule")

class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    check_in = Column(DateTime, nullable=False)
    check_out = Column(DateTime, nullable=True)
    worked_hours = Column(Float, default=0.0)
    status = Column(String(20), default="present")  # present, late, absent, half_day
    is_manual_edit = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("Employee", back_populates="attendance")

class TimeOffType(Base):
    __tablename__ = "time_off_types"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False, unique=True)
    code = Column(String(20), nullable=False, unique=True)
    unit = Column(String(10), default="days")  # days, hours
    requires_allocation = Column(Boolean, default=True)
    requires_approval = Column(Boolean, default=True)
    affects_payroll = Column(Boolean, default=False)
    color = Column(String(7), default="#3B82F6")
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class TimeOffAllocation(Base):
    __tablename__ = "time_off_allocations"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    time_off_type_id = Column(String(36), ForeignKey("time_off_types.id", ondelete="CASCADE"), nullable=False)
    allocated_days = Column(Float, nullable=False, default=0.0)
    taken_days = Column(Float, nullable=False, default=0.0)
    date_from = Column(Date, nullable=False)
    date_to = Column(Date, nullable=False)
    status = Column(String(20), default="draft")  # draft, approved, refused
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="time_off_allocations")
    time_off_type = relationship("TimeOffType")

    @property
    def remaining_days(self) -> float:
        return max(0.0, self.allocated_days - self.taken_days)

class TimeOffRequest(Base):
    __tablename__ = "time_off_requests"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    time_off_type_id = Column(String(36), ForeignKey("time_off_types.id", ondelete="CASCADE"), nullable=False)
    allocation_id = Column(String(36), ForeignKey("time_off_allocations.id"), nullable=True)
    date_from = Column(Date, nullable=False)
    date_to = Column(Date, nullable=False)
    duration_days = Column(Float, nullable=False, default=0.0)
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="draft")  # draft, pending, approved, refused, cancelled
    approved_by = Column(String(36), ForeignKey("employees.id"), nullable=True)
    response_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("Employee", back_populates="time_off_requests", foreign_keys=[employee_id])
    time_off_type = relationship("TimeOffType")
    approver = relationship("Employee", foreign_keys=[approved_by])

class Payrun(Base):
    __tablename__ = "payruns"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(150), nullable=False)
    salary_structure_id = Column(String(36), ForeignKey("salary_structures.id"), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    status = Column(String(20), default="draft")  # draft, computed, validated, paid
    employee_type_filter = Column(String(20), nullable=True)
    department_id = Column(String(36), ForeignKey("departments.id"), nullable=True)
    total_net = Column(Float, default=0.0)
    total_gross = Column(Float, default=0.0)
    payslip_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    salary_structure = relationship("SalaryStructure")
    department = relationship("Department")
    payslips = relationship("Payslip", back_populates="payrun", cascade="all, delete-orphan")

class Payslip(Base):
    __tablename__ = "payslips"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    payrun_id = Column(String(36), ForeignKey("payruns.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    contract_id = Column(String(36), ForeignKey("contracts.id"), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    worked_days = Column(Float, default=0.0)
    worked_hours = Column(Float, default=0.0)
    basic_salary = Column(Float, default=0.0)
    total_allowances = Column(Float, default=0.0)
    gross_salary = Column(Float, default=0.0)
    total_deductions = Column(Float, default=0.0)
    net_salary = Column(Float, default=0.0)
    status = Column(String(20), default="draft")  # draft, computed, validated, paid
    warnings_json = Column(Text, default="[]")  # JSON string of warnings
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    payrun = relationship("Payrun", back_populates="payslips")
    employee = relationship("Employee")
    contract = relationship("Contract")
    lines = relationship("PayslipLine", back_populates="payslip", cascade="all, delete-orphan", order_by="PayslipLine.sequence")

class PayslipLine(Base):
    __tablename__ = "payslip_lines"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    payslip_id = Column(String(36), ForeignKey("payslips.id", ondelete="CASCADE"), nullable=False)
    salary_rule_id = Column(String(36), ForeignKey("salary_rules.id"), nullable=False)
    rule_name = Column(String(100), nullable=False)
    rule_code = Column(String(30), nullable=False)
    category = Column(String(20), nullable=False)
    sequence = Column(Integer, nullable=False)
    amount = Column(Float, default=0.0)

    payslip = relationship("Payslip", back_populates="lines")

class AppUser(Base):
    __tablename__ = "app_users"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    employee_id = Column(String(36), ForeignKey("employees.id"), unique=True, nullable=True)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee")
    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    invitation = relationship("UserInvitation", back_populates="user", uselist=False, cascade="all, delete-orphan")

class UserRole(Base):
    __tablename__ = "user_roles"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(30), nullable=False)  # employee, hr_manager, hr_payroll_user, hr_payroll_manager, admin

    user = relationship("AppUser", back_populates="roles")

class UserInvitation(Base):
    __tablename__ = "user_invitations"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, unique=True)
    token_hash = Column(String(64), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    used_at = Column(DateTime, nullable=True)

    user = relationship("AppUser", back_populates="invitation")
