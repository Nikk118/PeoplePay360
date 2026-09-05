from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import models
from app.schemas.schemas import (
    SalaryStructureCreate, SalaryStructureUpdate, SalaryStructureResponse,
    SalaryRuleCreate, SalaryRuleUpdate, SalaryRuleResponse
)
from app.auth.rbac import get_current_user, require_roles, TokenData

router = APIRouter(prefix="/salary-structures", tags=["Salary Structures"])
rules_router = APIRouter(prefix="/salary-rules", tags=["Salary Rules"])

def build_structure_response(struct: models.SalaryStructure) -> SalaryStructureResponse:
    # Sort rules by sequence
    sorted_rules = sorted(struct.rules, key=lambda r: r.sequence) if struct.rules else []
    rule_responses = [SalaryRuleResponse.model_validate(r) for r in sorted_rules]
    return SalaryStructureResponse(
        id=struct.id,
        name=struct.name,
        description=struct.description,
        active=struct.active,
        rule_count=len(sorted_rules),
        rules=rule_responses,
        created_at=struct.created_at,
        updated_at=struct.updated_at
    )

# ----------------- SALARY STRUCTURES -----------------

@router.get("", response_model=List[SalaryStructureResponse])
def list_salary_structures(
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_user", "hr_payroll_manager"]))
):
    structures = db.query(models.SalaryStructure).order_by(models.SalaryStructure.name).all()
    return [build_structure_response(s) for s in structures]

@router.get("/{structure_id}", response_model=SalaryStructureResponse)
def get_salary_structure(
    structure_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_user", "hr_payroll_manager"]))
):
    struct = db.query(models.SalaryStructure).filter(models.SalaryStructure.id == structure_id).first()
    if not struct:
        raise HTTPException(status_code=404, detail="Salary structure not found")
    return build_structure_response(struct)

@router.post("", response_model=SalaryStructureResponse, status_code=status.HTTP_201_CREATED)
def create_salary_structure(
    body: SalaryStructureCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_manager"]))
):
    # Check duplicate name
    existing = db.query(models.SalaryStructure).filter(
        func.lower(models.SalaryStructure.name) == body.name.strip().lower()
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Salary structure with name '{body.name}' already exists")
    
    struct = models.SalaryStructure(
        name=body.name.strip(),
        description=body.description,
        active=body.active
    )
    db.add(struct)
    db.flush()

    if body.rules:
        for r_create in body.rules:
            rule = models.SalaryRule(
                structure_id=struct.id,
                name=r_create.name.strip(),
                code=r_create.code.strip().upper(),
                category=r_create.category.strip().lower(),
                sequence=r_create.sequence,
                computation_type=r_create.computation_type.strip().lower(),
                fixed_amount=r_create.fixed_amount,
                percentage=r_create.percentage,
                percentage_base=r_create.percentage_base,
                formula=r_create.formula,
                active=r_create.active,
                appears_on_payslip=r_create.appears_on_payslip
            )
            db.add(rule)

    db.commit()
    db.refresh(struct)
    return build_structure_response(struct)

@router.put("/{structure_id}", response_model=SalaryStructureResponse)
def update_salary_structure(
    structure_id: str,
    body: SalaryStructureUpdate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_manager"]))
):
    struct = db.query(models.SalaryStructure).filter(models.SalaryStructure.id == structure_id).first()
    if not struct:
        raise HTTPException(status_code=404, detail="Salary structure not found")
    
    if body.name is not None:
        name_clean = body.name.strip()
        existing = db.query(models.SalaryStructure).filter(
            models.SalaryStructure.id != structure_id,
            func.lower(models.SalaryStructure.name) == name_clean.lower()
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Salary structure with name '{name_clean}' already exists")
        struct.name = name_clean
    
    if body.description is not None:
        struct.description = body.description
    if body.active is not None:
        struct.active = body.active

    db.commit()
    db.refresh(struct)
    return build_structure_response(struct)

@router.delete("/{structure_id}")
def delete_salary_structure(
    structure_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_manager"]))
):
    struct = db.query(models.SalaryStructure).filter(models.SalaryStructure.id == structure_id).first()
    if not struct:
        raise HTTPException(status_code=404, detail="Salary structure not found")

    # Safe delete check: Contracts or Payruns
    contract_count = db.query(models.Contract).filter(models.Contract.salary_structure_id == structure_id).count()
    if contract_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete salary structure '{struct.name}' because it is assigned to {contract_count} contract(s)"
        )
    
    payrun_count = db.query(models.Payrun).filter(models.Payrun.salary_structure_id == structure_id).count()
    if payrun_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete salary structure '{struct.name}' because it is associated with {payrun_count} payrun(s)"
        )

    db.delete(struct)
    db.commit()
    return {"message": f"Salary structure '{struct.name}' deleted successfully"}

@router.get("/{structure_id}/rules", response_model=List[SalaryRuleResponse])
def get_rules_for_structure(
    structure_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    struct = db.query(models.SalaryStructure).filter(models.SalaryStructure.id == structure_id).first()
    if not struct:
        raise HTTPException(status_code=404, detail="Salary structure not found")
    
    rules = db.query(models.SalaryRule).filter(
        models.SalaryRule.structure_id == structure_id
    ).order_by(models.SalaryRule.sequence.asc()).all()
    
    return [SalaryRuleResponse.model_validate(r) for r in rules]


# ----------------- SALARY RULES -----------------

@rules_router.get("", response_model=List[SalaryRuleResponse])
def list_salary_rules(
    structure_id: Optional[str] = Query(None, description="Filter rules by structure ID"),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_user", "hr_payroll_manager"]))
):
    query = db.query(models.SalaryRule)
    if structure_id:
        query = query.filter(models.SalaryRule.structure_id == structure_id)
    rules = query.order_by(models.SalaryRule.sequence.asc()).all()
    return [SalaryRuleResponse.model_validate(r) for r in rules]

@rules_router.get("/{rule_id}", response_model=SalaryRuleResponse)
def get_salary_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_user", "hr_payroll_manager"]))
):
    rule = db.query(models.SalaryRule).filter(models.SalaryRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Salary rule not found")
    return SalaryRuleResponse.model_validate(rule)

@rules_router.post("", response_model=SalaryRuleResponse, status_code=status.HTTP_201_CREATED)
def create_salary_rule(
    body: SalaryRuleCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_manager"]))
):
    if not body.structure_id:
        raise HTTPException(status_code=400, detail="structure_id is required to create a salary rule")
    
    struct = db.query(models.SalaryStructure).filter(models.SalaryStructure.id == body.structure_id).first()
    if not struct:
        raise HTTPException(status_code=404, detail="Salary structure not found")

    code_clean = body.code.strip().upper()

    # Unique rule code within structure validation
    existing_code = db.query(models.SalaryRule).filter(
        models.SalaryRule.structure_id == body.structure_id,
        func.lower(models.SalaryRule.code) == code_clean.lower()
    ).first()
    if existing_code:
        raise HTTPException(
            status_code=400,
            detail=f"Salary rule with code '{code_clean}' already exists in structure '{struct.name}'"
        )

    rule = models.SalaryRule(
        structure_id=body.structure_id,
        name=body.name.strip(),
        code=code_clean,
        category=body.category.strip().lower(),
        sequence=body.sequence,
        computation_type=body.computation_type.strip().lower(),
        fixed_amount=body.fixed_amount,
        percentage=body.percentage,
        percentage_base=body.percentage_base.strip() if body.percentage_base else None,
        formula=body.formula.strip() if body.formula else None,
        active=body.active,
        appears_on_payslip=body.appears_on_payslip
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return SalaryRuleResponse.model_validate(rule)

@rules_router.put("/{rule_id}", response_model=SalaryRuleResponse)
def update_salary_rule(
    rule_id: str,
    body: SalaryRuleUpdate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_manager"]))
):
    rule = db.query(models.SalaryRule).filter(models.SalaryRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Salary rule not found")

    if body.code is not None:
        code_clean = body.code.strip().upper()
        existing_code = db.query(models.SalaryRule).filter(
            models.SalaryRule.id != rule_id,
            models.SalaryRule.structure_id == rule.structure_id,
            func.lower(models.SalaryRule.code) == code_clean.lower()
        ).first()
        if existing_code:
            raise HTTPException(
                status_code=400,
                detail=f"Salary rule with code '{code_clean}' already exists in this structure"
            )
        rule.code = code_clean

    if body.name is not None:
        rule.name = body.name.strip()
    if body.category is not None:
        rule.category = body.category.strip().lower()
    if body.sequence is not None:
        rule.sequence = body.sequence
    if body.computation_type is not None:
        rule.computation_type = body.computation_type.strip().lower()
    if body.fixed_amount is not None:
        rule.fixed_amount = body.fixed_amount
    if body.percentage is not None:
        rule.percentage = body.percentage
    if body.percentage_base is not None:
        rule.percentage_base = body.percentage_base.strip() if body.percentage_base else None
    if body.formula is not None:
        rule.formula = body.formula.strip() if body.formula else None
    if body.active is not None:
        rule.active = body.active
    if body.appears_on_payslip is not None:
        rule.appears_on_payslip = body.appears_on_payslip

    db.commit()
    db.refresh(rule)
    return SalaryRuleResponse.model_validate(rule)

@rules_router.delete("/{rule_id}")
def delete_salary_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_manager"]))
):
    rule = db.query(models.SalaryRule).filter(models.SalaryRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Salary rule not found")

    name = rule.name
    db.delete(rule)
    db.commit()
    return {"message": f"Salary rule '{name}' deleted successfully"}
