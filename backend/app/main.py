import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models import models
from app.routers import auth, departments, employees, schedules, contracts, attendance, time_off, salary_structures, payruns, payslips
from app.auth.jwt import get_password_hash

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(auth.user_router, prefix=settings.API_V1_STR)
app.include_router(departments.router, prefix=settings.API_V1_STR)
app.include_router(employees.router, prefix=settings.API_V1_STR)
app.include_router(schedules.router, prefix=settings.API_V1_STR)
app.include_router(contracts.router, prefix=settings.API_V1_STR)
app.include_router(attendance.router, prefix=settings.API_V1_STR)
app.include_router(time_off.router, prefix=settings.API_V1_STR)
app.include_router(salary_structures.router, prefix=settings.API_V1_STR)
app.include_router(salary_structures.rules_router, prefix=settings.API_V1_STR)
app.include_router(payruns.router, prefix=settings.API_V1_STR)
app.include_router(payslips.router, prefix=settings.API_V1_STR)


@app.on_event("startup")
def startup_event():
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Auto-seed database if empty
    db: Session = SessionLocal()
    try:
        if db.query(models.Department).count() == 0:
            print("Seeding initial database data...")
            seed_initial_data(db)
    finally:
        db.close()

def seed_initial_data(db: Session):
    # 1. Departments
    dept_eng = models.Department(id="11111111-1111-1111-1111-111111111111", name="Engineering")
    dept_hr = models.Department(id="22222222-2222-2222-2222-222222222222", name="Human Resources")
    dept_sales = models.Department(id="33333333-3333-3333-3333-333333333333", name="Sales & Marketing")
    dept_fin = models.Department(id="44444444-4444-4444-4444-444444444444", name="Finance")
    db.add_all([dept_eng, dept_hr, dept_sales, dept_fin])
    db.flush()

    # 2. Schedule
    sched = models.WorkingSchedule(id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name="Standard 40h (Mon-Fri)", schedule_type="standard")
    db.add(sched)
    db.flush()
    
    for day in range(5):  # Mon-Fri
        db.add(models.ScheduleLine(
            schedule_id=sched.id,
            day_of_week=day,
            start_time="09:00:00",
            end_time="17:30:00",
            break_duration_minutes=30
        ))
    db.flush()

    # 3. Employees
    emp_ravi = models.Employee(
        id="e1111111-1111-1111-1111-111111111111",
        employee_number="EMP001",
        first_name="Ravi",
        last_name="Kumar",
        email="employee@peoplepay360.com",
        phone="+91 98765 43210",
        gender="male",
        department_id=dept_eng.id,
        job_title="Senior Software Engineer",
        job_position="Senior Developer",
        employee_type="full_time",
        working_schedule_id=sched.id,
        status="active",
        bank_account_name="Ravi Kumar",
        bank_account_number="987654321012",
        bank_name="HDFC Bank"
    )
    emp_priya = models.Employee(
        id="e2222222-2222-2222-2222-222222222222",
        employee_number="EMP002",
        first_name="Priya",
        last_name="Sharma",
        email="hrmanager@peoplepay360.com",
        phone="+91 98765 43211",
        gender="female",
        department_id=dept_hr.id,
        job_title="HR Lead",
        job_position="HR Lead",
        employee_type="full_time",
        working_schedule_id=sched.id,
        status="active",
        bank_account_name="Priya Sharma",
        bank_account_number="987654321013",
        bank_name="ICICI Bank"
    )
    emp_vikram = models.Employee(
        id="e4444444-4444-4444-4444-444444444444",
        employee_number="EMP004",
        first_name="Vikram",
        last_name="Patel",
        email="payrollmanager@peoplepay360.com",
        phone="+91 98765 43213",
        gender="male",
        department_id=dept_fin.id,
        job_title="Payroll Specialist",
        job_position="Payroll Specialist",
        employee_type="full_time",
        working_schedule_id=sched.id,
        status="active",
        bank_account_name="Vikram Patel",
        bank_account_number="987654321015",
        bank_name="Axis Bank"
    )
    db.add_all([emp_ravi, emp_priya, emp_vikram])
    db.flush()
    
    emp_ravi.manager_id = emp_priya.id
    db.flush()

    # 4. Salary Structure & Rules
    struct = models.SalaryStructure(id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name="Regular Salary Structure", description="Standard salary structure", active=True)
    db.add(struct)
    db.flush()

    rules = [
        models.SalaryRule(structure_id=struct.id, name="Basic Salary", code="BASIC", category="basic", sequence=10, computation_type="percentage", percentage=100.0, percentage_base="contract_wage"),
        models.SalaryRule(structure_id=struct.id, name="House Rent Allowance", code="HRA", category="allowance", sequence=20, computation_type="percentage", percentage=20.0, percentage_base="BASIC"),
        models.SalaryRule(structure_id=struct.id, name="Meal Allowance", code="MA", category="allowance", sequence=30, computation_type="fixed", fixed_amount=2000.0),
        models.SalaryRule(structure_id=struct.id, name="Transport Allowance", code="TA", category="allowance", sequence=40, computation_type="fixed", fixed_amount=1500.0),
        models.SalaryRule(structure_id=struct.id, name="Gross Salary", code="GROSS", category="gross", sequence=50, computation_type="formula", formula="BASIC + HRA + MA + TA"),
        models.SalaryRule(structure_id=struct.id, name="Provident Fund", code="PF", category="deduction", sequence=60, computation_type="percentage", percentage=-12.0, percentage_base="BASIC"),
        models.SalaryRule(structure_id=struct.id, name="Income Tax", code="TAX", category="deduction", sequence=70, computation_type="formula", formula="-(GROSS * 0.10)"),
        models.SalaryRule(structure_id=struct.id, name="Unpaid Leave Deduction", code="UPL", category="deduction", sequence=80, computation_type="formula", formula="-(time_off_unpaid_days * (BASIC / 22.0))"),
        models.SalaryRule(structure_id=struct.id, name="Net Salary", code="NET", category="net", sequence=90, computation_type="formula", formula="GROSS + PF + TAX + UPL"),
    ]
    db.add_all(rules)
    db.flush()

    # 5. Contracts
    from datetime import date
    c_ravi = models.Contract(
        employee_id=emp_ravi.id,
        name="Ravi Kumar - Senior Dev Contract 2026",
        contract_type="permanent",
        department_id=dept_eng.id,
        job_position="Senior Developer",
        job_title="Senior Software Engineer",
        date_start=date(2026, 1, 1),
        wage=60000.0,
        salary_structure_id=struct.id,
        working_schedule_id=sched.id,
        status="active"
    )
    c_priya = models.Contract(
        employee_id=emp_priya.id,
        name="Priya Sharma - HR Lead Contract",
        contract_type="permanent",
        department_id=dept_hr.id,
        job_position="HR Lead",
        job_title="HR Lead",
        date_start=date(2026, 1, 1),
        wage=75000.0,
        salary_structure_id=struct.id,
        working_schedule_id=sched.id,
        status="active"
    )
    db.add_all([c_ravi, c_priya])
    db.flush()

    # 6. Time Off Types & Allocation
    tt_annual = models.TimeOffType(id="t1111111-1111-1111-1111-111111111111", name="Paid Annual Leave", code="ANNUAL", unit="days", requires_allocation=True, requires_approval=True, affects_payroll=False, color="#10B981")
    tt_unpaid = models.TimeOffType(id="t3333333-3333-3333-3333-333333333333", name="Unpaid Leave", code="UNPAID", unit="days", requires_allocation=False, requires_approval=True, affects_payroll=True, color="#EF4444")
    db.add_all([tt_annual, tt_unpaid])
    db.flush()

    alloc = models.TimeOffAllocation(
        id="a1111111-1111-1111-1111-111111111111",
        employee_id=emp_ravi.id,
        time_off_type_id=tt_annual.id,
        allocated_days=20.0,
        taken_days=0.0,
        date_from=date(2026, 1, 1),
        date_to=date(2026, 12, 31),
        status="approved"
    )
    db.add(alloc)
    db.flush()

    # 7. Users & Roles (Password: Password123!)
    pwd_hash = get_password_hash("Password123!")
    u_emp = models.AppUser(id="u1111111-1111-1111-1111-111111111111", employee_id=emp_ravi.id, email="employee@peoplepay360.com", password_hash=pwd_hash, is_active=True)
    u_hr = models.AppUser(id="u2222222-2222-2222-2222-222222222222", employee_id=emp_priya.id, email="hrmanager@peoplepay360.com", password_hash=pwd_hash, is_active=True)
    u_payroll = models.AppUser(id="u3333333-3333-3333-3333-333333333333", employee_id=emp_vikram.id, email="payrollmanager@peoplepay360.com", password_hash=pwd_hash, is_active=True)
    u_admin = models.AppUser(id="u4444444-4444-4444-4444-444444444444", employee_id=None, email="admin@peoplepay360.com", password_hash=pwd_hash, is_active=True)
    db.add_all([u_emp, u_hr, u_payroll, u_admin])
    db.flush()

    db.add_all([
        models.UserRole(user_id=u_emp.id, role="employee"),
        models.UserRole(user_id=u_hr.id, role="hr_manager"),
        models.UserRole(user_id=u_payroll.id, role="hr_payroll_manager"),
        models.UserRole(user_id=u_admin.id, role="admin"),
    ])
    
    db.commit()
    print("Initial data seeded successfully!")

@app.get("/api/health")
def health_check():
    return {"status": "online", "app": settings.PROJECT_NAME, "version": "1.0.0"}
