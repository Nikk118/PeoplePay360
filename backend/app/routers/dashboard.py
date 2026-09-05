import json
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func, case

from app.database import get_db
from app.models import models
from app.schemas import schemas
from app.auth.rbac import get_current_user, TokenData

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Reports"])

def is_management_user(user: TokenData) -> bool:
    mgmt_roles = {"admin", "hr_manager", "hr_payroll_user", "hr_payroll_manager"}
    return any(r in mgmt_roles for r in user.roles)

def apply_payslip_filters(
    query,
    current_user: TokenData,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
    department_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    payrun_id: Optional[str] = None
):
    # RBAC restriction
    if not is_management_user(current_user):
        if not current_user.employee_id:
            return query.filter(models.Payslip.id == "none")
        query = query.filter(models.Payslip.employee_id == current_user.employee_id)
    elif department_id:
        query = query.join(models.Employee, models.Payslip.employee_id == models.Employee.id).filter(
            models.Employee.department_id == department_id
        )

    if payrun_id:
        query = query.filter(models.Payslip.payrun_id == payrun_id)
    if status_filter and status_filter != 'all':
        query = query.filter(models.Payslip.status == status_filter)
    if period_start:
        query = query.filter(models.Payslip.period_start >= period_start)
    if period_end:
        query = query.filter(models.Payslip.period_end <= period_end)

    return query


@router.get("/summary", response_model=schemas.DashboardSummaryResponse)
def get_dashboard_summary(
    period_start: Optional[date] = Query(None),
    period_end: Optional[date] = Query(None),
    department_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    payrun_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get high-level summary of payroll metrics (Gross, Net, Deductions, Payslips, Employees).
    """
    payslip_query = apply_payslip_filters(
        db.query(models.Payslip),
        current_user,
        period_start=period_start,
        period_end=period_end,
        department_id=department_id,
        status_filter=status_filter,
        payrun_id=payrun_id
    )

    payslips = payslip_query.all()

    total_gross = sum(float(p.gross_salary or 0.0) for p in payslips)
    total_deductions = sum(float(p.total_deductions or 0.0) for p in payslips)
    total_net = sum(float(p.net_salary or 0.0) for p in payslips)
    total_basic = sum(float(p.basic_salary or 0.0) for p in payslips)
    total_allowances = sum(float(p.total_allowances or 0.0) for p in payslips)
    payslip_count = len(payslips)
    
    unique_emp_ids = {p.employee_id for p in payslips if p.employee_id}
    employee_count = len(unique_emp_ids)

    # Active employee count in organization / department scope
    emp_query = db.query(models.Employee).filter(models.Employee.status == "active")
    if not is_management_user(current_user):
        emp_query = emp_query.filter(models.Employee.id == current_user.employee_id)
    elif department_id:
        emp_query = emp_query.filter(models.Employee.department_id == department_id)
    total_employees = emp_query.count()

    # Period info
    selected_period = None
    if payrun_id:
        pr = db.query(models.Payrun).filter(models.Payrun.id == payrun_id).first()
        if pr:
            selected_period = schemas.SelectedPeriodInfo(
                start_date=str(pr.period_start),
                end_date=str(pr.period_end),
                payrun_name=pr.name
            )
    elif period_start or period_end:
        selected_period = schemas.SelectedPeriodInfo(
            start_date=str(period_start) if period_start else None,
            end_date=str(period_end) if period_end else None,
            payrun_name="Filtered Period"
        )

    return schemas.DashboardSummaryResponse(
        total_gross_salary=round(total_gross, 2),
        total_deductions=round(total_deductions, 2),
        total_net_salary=round(total_net, 2),
        total_basic_salary=round(total_basic, 2),
        total_allowances=round(total_allowances, 2),
        payslip_count=payslip_count,
        employee_count=employee_count,
        total_employees=total_employees,
        selected_period=selected_period
    )


@router.get("/payslip-status", response_model=schemas.PayslipStatusCounts)
def get_payslip_status(
    period_start: Optional[date] = Query(None),
    period_end: Optional[date] = Query(None),
    department_id: Optional[str] = Query(None),
    payrun_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get live payslip counts categorized by status (draft, computed, validated, paid).
    """
    payslip_query = apply_payslip_filters(
        db.query(models.Payslip),
        current_user,
        period_start=period_start,
        period_end=period_end,
        department_id=department_id,
        payrun_id=payrun_id
    )

    payslips = payslip_query.all()

    counts = {"draft": 0, "computed": 0, "validated": 0, "paid": 0}
    for p in payslips:
        st = (p.status or "draft").lower()
        if st in counts:
            counts[st] += 1
        else:
            counts[st] = 1

    return schemas.PayslipStatusCounts(
        draft=counts.get("draft", 0),
        computed=counts.get("computed", 0),
        validated=counts.get("validated", 0),
        paid=counts.get("paid", 0),
        total=len(payslips)
    )


@router.get("/salary-by-department", response_model=List[schemas.SalaryByDepartmentItem])
def get_salary_by_department(
    period_start: Optional[date] = Query(None),
    period_end: Optional[date] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    payrun_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Aggregate payroll totals (gross & net salary) by department from live database records.
    """
    payslip_query = apply_payslip_filters(
        db.query(models.Payslip),
        current_user,
        period_start=period_start,
        period_end=period_end,
        status_filter=status_filter,
        payrun_id=payrun_id
    )

    # Eagerly load employee to avoid N+1
    payslips = payslip_query.options(joinedload(models.Payslip.employee)).all()

    dept_map = {}
    # Fetch all departments once
    all_depts = {d.id: d.name for d in db.query(models.Department).all()}

    for p in payslips:
        emp = p.employee
        dept_id = emp.department_id if emp else None
        dept_name = all_depts.get(dept_id, "General / Unassigned") if dept_id else "General / Unassigned"

        key = dept_id or "unassigned"
        if key not in dept_map:
            dept_map[key] = {
                "department_id": dept_id,
                "department_name": dept_name,
                "total_gross": 0.0,
                "total_net": 0.0,
                "employee_ids": set()
            }

        dept_map[key]["total_gross"] += float(p.gross_salary or 0.0)
        dept_map[key]["total_net"] += float(p.net_salary or 0.0)
        if p.employee_id:
            dept_map[key]["employee_ids"].add(p.employee_id)

    result = [
        schemas.SalaryByDepartmentItem(
            department_id=v["department_id"],
            department_name=v["department_name"],
            total_gross=round(v["total_gross"], 2),
            total_net=round(v["total_net"], 2),
            employee_count=len(v["employee_ids"])
        )
        for v in dept_map.values()
    ]

    # Sort descending by total_gross
    result.sort(key=lambda item: item.total_gross, reverse=True)
    return result


@router.get("/payroll-trends", response_model=List[schemas.PayrollTrendItem])
def get_payroll_trends(
    department_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get payroll trend data across available Payruns and period months.
    """
    payruns = db.query(models.Payrun).order_by(models.Payrun.period_start.asc()).all()
    if not payruns:
        return []

    # Aggregate all payslip totals per payrun in a single query instead of N+1 per payrun
    ps_q = db.query(
        models.Payslip.payrun_id,
        func.sum(models.Payslip.gross_salary).label("total_gross"),
        func.sum(models.Payslip.net_salary).label("total_net"),
        func.sum(models.Payslip.total_deductions).label("total_deductions"),
        func.count(models.Payslip.id).label("payslip_count")
    )

    if not is_management_user(current_user):
        if not current_user.employee_id:
            return []
        ps_q = ps_q.filter(models.Payslip.employee_id == current_user.employee_id)
    elif department_id:
        ps_q = ps_q.join(models.Employee, models.Payslip.employee_id == models.Employee.id).filter(
            models.Employee.department_id == department_id
        )

    agg_rows = ps_q.group_by(models.Payslip.payrun_id).all()
    agg_by_payrun = {r.payrun_id: r for r in agg_rows}

    trends = []
    for pr in payruns:
        agg = agg_by_payrun.get(pr.id)
        # Skip payruns with no payslips for non-management users
        if agg is None and not is_management_user(current_user):
            continue

        trends.append(schemas.PayrollTrendItem(
            payrun_id=pr.id,
            payrun_name=pr.name,
            period_start=str(pr.period_start),
            period_end=str(pr.period_end),
            total_gross=round(float(agg.total_gross or 0.0), 2) if agg else 0.0,
            total_net=round(float(agg.total_net or 0.0), 2) if agg else 0.0,
            total_deductions=round(float(agg.total_deductions or 0.0), 2) if agg else 0.0,
            payslip_count=agg.payslip_count if agg else 0,
            status=pr.status
        ))

    return trends


@router.get("/attendance", response_model=schemas.AttendanceSummaryResponse)
def get_attendance_summary(
    period_start: Optional[date] = Query(None),
    period_end: Optional[date] = Query(None),
    department_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get summary of attendance records, worked hours, and status breakdown.
    """
    query = db.query(models.Attendance)

    if not is_management_user(current_user):
        if not current_user.employee_id:
            return schemas.AttendanceSummaryResponse()
        query = query.filter(models.Attendance.employee_id == current_user.employee_id)
    elif department_id:
        query = query.join(models.Employee, models.Attendance.employee_id == models.Employee.id).filter(
            models.Employee.department_id == department_id
        )

    if period_start:
        query = query.filter(func.date(models.Attendance.check_in) >= period_start)
    if period_end:
        query = query.filter(func.date(models.Attendance.check_in) <= period_end)

    records = query.all()

    by_status = {}
    present = 0
    absent = 0
    half_day = 0
    late = 0
    total_hours = 0.0

    for r in records:
        st = (r.status or "present").lower()
        by_status[st] = by_status.get(st, 0) + 1
        if st in ("present", "approved", "completed"):
            present += 1
        elif st == "absent":
            absent += 1
        elif st in ("half_day", "half-day"):
            half_day += 1
        elif st == "late":
            late += 1
        # Unknown/unrecognised statuses are counted in by_status only,
        # not added to any specific bucket (prevents miscounting as 'present').

        total_hours += float(r.worked_hours or 0.0)

    return schemas.AttendanceSummaryResponse(
        total_records=len(records),
        present_records=present,
        absent_records=absent,
        half_day_records=half_day,
        late_records=late,
        total_worked_hours=round(total_hours, 2),
        by_status=by_status
    )


@router.get("/time-off", response_model=schemas.TimeOffSummaryResponse)
def get_time_off_summary(
    period_start: Optional[date] = Query(None),
    period_end: Optional[date] = Query(None),
    department_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get summary of time off requests and leave allocations.
    """
    req_query = db.query(models.TimeOffRequest)

    if not is_management_user(current_user):
        if not current_user.employee_id:
            return schemas.TimeOffSummaryResponse()
        req_query = req_query.filter(models.TimeOffRequest.employee_id == current_user.employee_id)
    elif department_id:
        req_query = req_query.join(models.Employee, models.TimeOffRequest.employee_id == models.Employee.id).filter(
            models.Employee.department_id == department_id
        )

    if period_start:
        req_query = req_query.filter(models.TimeOffRequest.date_from >= period_start)
    if period_end:
        req_query = req_query.filter(models.TimeOffRequest.date_to <= period_end)

    requests = req_query.all()

    pending = sum(1 for r in requests if r.status == "pending")
    approved = sum(1 for r in requests if r.status == "approved")
    refused = sum(1 for r in requests if r.status in ("refused", "rejected"))

    # Allocations
    alloc_query = db.query(models.TimeOffAllocation)
    if not is_management_user(current_user):
        alloc_query = alloc_query.filter(models.TimeOffAllocation.employee_id == current_user.employee_id)
    elif department_id:
        alloc_query = alloc_query.join(models.Employee, models.TimeOffAllocation.employee_id == models.Employee.id).filter(
            models.Employee.department_id == department_id
        )

    allocations = alloc_query.all()

    total_allocated = sum(float(a.allocated_days or 0.0) for a in allocations)
    total_taken = sum(float(a.taken_days or 0.0) for a in allocations)
    total_remaining = max(0.0, total_allocated - total_taken)

    # By type summary
    type_map = {}
    time_types = {t.id: t for t in db.query(models.TimeOffType).all()}

    for a in allocations:
        tt = time_types.get(a.time_off_type_id)
        name = tt.name if tt else "Leave"
        code = tt.code if tt else "LEAVE"
        
        if code not in type_map:
            type_map[code] = {"type_name": name, "code": code, "allocated": 0.0, "taken": 0.0}
        type_map[code]["allocated"] += float(a.allocated_days or 0.0)
        type_map[code]["taken"] += float(a.taken_days or 0.0)

    by_type_list = [
        schemas.TimeOffTypeSummaryItem(
            type_name=v["type_name"],
            code=v["code"],
            allocated=round(v["allocated"], 1),
            taken=round(v["taken"], 1)
        )
        for v in type_map.values()
    ]

    return schemas.TimeOffSummaryResponse(
        pending_requests=pending,
        approved_requests=approved,
        refused_requests=refused,
        total_allocated_days=round(total_allocated, 1),
        used_days=round(total_taken, 1),
        remaining_days=round(total_remaining, 1),
        by_type=by_type_list
    )


@router.get("/warnings", response_model=List[schemas.DashboardWarningItem])
def get_dashboard_warnings(
    department_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get live audit warnings (employees missing contracts, missing schedules, missing info, payroll calculation warnings).
    """
    warnings = []

    # Query active employees
    emp_query = db.query(models.Employee).filter(models.Employee.status == "active")
    if not is_management_user(current_user):
        if current_user.employee_id:
            emp_query = emp_query.filter(models.Employee.id == current_user.employee_id)
        else:
            return []
    elif department_id:
        emp_query = emp_query.filter(models.Employee.department_id == department_id)

    active_emps = emp_query.all()

    today = date.today()

    # Pre-fetch all active contracts for the active employees in one query (avoids N+1)
    active_emp_ids = [e.id for e in active_emps]
    active_contracts_q = db.query(models.Contract.employee_id).filter(
        models.Contract.employee_id.in_(active_emp_ids),
        models.Contract.status == "active",
        models.Contract.date_start <= today,
        or_(models.Contract.date_end == None, models.Contract.date_end >= today)
    ).all()
    employees_with_contract = {row.employee_id for row in active_contracts_q}

    for emp in active_emps:
        emp_name = f"{emp.first_name} {emp.last_name}"

        # 1. Missing schedule
        if not emp.working_schedule_id:
            warnings.append(schemas.DashboardWarningItem(
                category="Schedule Missing",
                message=f"{emp_name} ({emp.employee_number}) has no working schedule assigned.",
                employee_id=emp.id,
                employee_name=emp_name,
                severity="warning"
            ))

        # 2. Active contract check (uses pre-fetched set — no per-employee query)
        if emp.id not in employees_with_contract:
            warnings.append(schemas.DashboardWarningItem(
                category="Contract Missing",
                message=f"{emp_name} ({emp.employee_number}) has no active contract for current date.",
                employee_id=emp.id,
                employee_name=emp_name,
                severity="error"
            ))

        # 3. Bank account check
        if not emp.bank_account_number or not emp.bank_name:
            warnings.append(schemas.DashboardWarningItem(
                category="Info Missing",
                message=f"{emp_name} ({emp.employee_number}) is missing bank account information.",
                employee_id=emp.id,
                employee_name=emp_name,
                severity="info"
            ))

    # 4. Check for payslip calculation warnings in recent payslips
    payslip_q = db.query(models.Payslip)
    if not is_management_user(current_user):
        payslip_q = payslip_q.filter(models.Payslip.employee_id == current_user.employee_id)
    elif department_id:
        payslip_q = payslip_q.join(models.Employee, models.Payslip.employee_id == models.Employee.id).filter(
            models.Employee.department_id == department_id
        )

    recent_payslips = payslip_q.order_by(models.Payslip.created_at.desc()).limit(20).all()
    for ps in recent_payslips:
        if ps.warnings_json:
            try:
                msg_list = json.loads(ps.warnings_json)
                emp_name = f"{ps.employee.first_name} {ps.employee.last_name}" if ps.employee else "Employee"
                for msg in msg_list:
                    warnings.append(schemas.DashboardWarningItem(
                        category="Payroll Issue",
                        message=f"Payslip for {emp_name}: {msg}",
                        employee_id=ps.employee_id,
                        employee_name=emp_name,
                        severity="warning"
                    ))
            except Exception:
                pass

    return warnings


@router.get("/overview", response_model=schemas.DashboardOverviewResponse)
def get_dashboard_overview(
    period_start: Optional[date] = Query(None),
    period_end: Optional[date] = Query(None),
    department_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    payrun_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Consolidated Dashboard endpoint returning all metrics, summaries, trends, and warnings in a single call.
    """
    summary = get_dashboard_summary(
        period_start=period_start,
        period_end=period_end,
        department_id=department_id,
        status_filter=status_filter,
        payrun_id=payrun_id,
        db=db,
        current_user=current_user
    )

    payslip_status = get_payslip_status(
        period_start=period_start,
        period_end=period_end,
        department_id=department_id,
        payrun_id=payrun_id,
        db=db,
        current_user=current_user
    )

    salary_by_dept = get_salary_by_department(
        period_start=period_start,
        period_end=period_end,
        status_filter=status_filter,
        payrun_id=payrun_id,
        db=db,
        current_user=current_user
    )

    payroll_trends = get_payroll_trends(
        department_id=department_id,
        db=db,
        current_user=current_user
    )

    attendance = get_attendance_summary(
        period_start=period_start,
        period_end=period_end,
        department_id=department_id,
        db=db,
        current_user=current_user
    )

    time_off = get_time_off_summary(
        period_start=period_start,
        period_end=period_end,
        department_id=department_id,
        db=db,
        current_user=current_user
    )

    warnings = get_dashboard_warnings(
        department_id=department_id,
        db=db,
        current_user=current_user
    )

    return schemas.DashboardOverviewResponse(
        summary=summary,
        payslip_status=payslip_status,
        salary_by_department=salary_by_dept,
        payroll_trends=payroll_trends,
        attendance=attendance,
        time_off=time_off,
        warnings=warnings
    )
