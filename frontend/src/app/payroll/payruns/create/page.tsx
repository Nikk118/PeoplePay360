'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { 
  DollarSign, ArrowLeft, ArrowRight, CheckCircle, AlertCircle, 
  Layers, Users, Calendar, Filter, RefreshCw, Check, X, ShieldAlert
} from 'lucide-react';

interface SalaryStructure {
  id: string;
  name: string;
  active: boolean;
  rule_count: number;
}

interface Department {
  id: string;
  name: string;
}

interface EligibleEmployee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email?: string;
  department_id?: string;
  department_name?: string;
  employee_type: string;
  contract_id?: string;
  contract_name?: string;
  contract_status?: string;
  has_applicable_contract: boolean;
}

export default function CreatePayrunPage() {
  const router = useRouter();
  const { user, hasRole } = useAuth();

  // Wizard Step: 1 = Configuration, 2 = Employee Selection
  const [step, setStep] = useState<1 | 2>(1);

  // Data Sources
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Step 1 State
  const [name, setName] = useState('Monthly Payroll Run');
  const [salaryStructureId, setSalaryStructureId] = useState('');
  const [periodStart, setPeriodStart] = useState('2026-10-01');
  const [periodEnd, setPeriodEnd] = useState('2026-10-31');
  const [departmentId, setDepartmentId] = useState('');
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState('');

  // Step 2 State
  const [eligibleEmployees, setEligibleEmployees] = useState<EligibleEmployee[]>([]);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [fetchingEmployees, setFetchingEmployees] = useState(false);

  // UI State
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [structData, deptData] = await Promise.all([
        apiRequest<SalaryStructure[]>('/salary-structures'),
        apiRequest<Department[]>('/departments')
      ]);
      const activeStructs = structData.filter(s => s.active);
      setStructures(activeStructs);
      if (activeStructs.length > 0) {
        setSalaryStructureId(activeStructs[0].id);
      }
      setDepartments(deptData);
    } catch (err: any) {
      setError(err.message || 'Failed to load setup data');
    }
  };

  // Step 1 -> Step 2 transition
  const handleProceedToStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter a payrun name');
      return;
    }
    if (!salaryStructureId) {
      setError('Please select a salary structure');
      return;
    }
    if (!periodStart || !periodEnd) {
      setError('Please select start and end dates');
      return;
    }
    if (periodStart > periodEnd) {
      setError('Start date cannot be after end date');
      return;
    }

    setFetchingEmployees(true);
    try {
      const queryParams = new URLSearchParams({
        period_start: periodStart,
        period_end: periodEnd,
        salary_structure_id: salaryStructureId
      });
      if (departmentId) queryParams.append('department_id', departmentId);
      if (employeeTypeFilter) queryParams.append('employee_type', employeeTypeFilter);

      const data = await apiRequest<EligibleEmployee[]>(`/payruns/eligible-employees?${queryParams.toString()}`);
      setEligibleEmployees(data);

      // Auto-select valid employees with contracts by default, but user can change
      const validEmpIds = data.filter(e => e.has_applicable_contract).map(e => e.id);
      setSelectedEmpIds(validEmpIds);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch eligible employees');
    } finally {
      setFetchingEmployees(false);
    }
  };

  // Checkbox Handlers
  const toggleEmployeeSelect = (empId: string, hasContract: boolean) => {
    if (!hasContract) return; // Cannot select employee without valid contract
    setSelectedEmpIds(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  const handleSelectAllValid = () => {
    const validIds = eligibleEmployees.filter(e => e.has_applicable_contract).map(e => e.id);
    setSelectedEmpIds(validIds);
  };

  const handleDeselectAll = () => {
    setSelectedEmpIds([]);
  };

  // Final Submit -> Create Payrun
  const handleCreatePayrun = async () => {
    setError(null);
    if (selectedEmpIds.length === 0) {
      setError('You must select at least one employee for the payrun.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name,
        salary_structure_id: salaryStructureId,
        period_start: periodStart,
        period_end: periodEnd,
        employee_ids: selectedEmpIds,
        department_id: departmentId || null,
        employee_type_filter: employeeTypeFilter || null
      };

      const res = await apiRequest<{ id: string }>('/payruns', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      router.push(`/payroll/payruns/${res.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create payrun');
    } finally {
      setSubmitting(false);
    }
  };

  if (user && !hasRole(['admin', 'hr_payroll_user', 'hr_payroll_manager'])) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
        <Navbar />
        <main style={{ maxWidth: '800px', margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
          <div className="glass-panel" style={{ padding: '3rem 2rem' }}>
            <AlertCircle size={48} color="var(--red)" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Access Denied</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              HR Managers do not have access to payroll features (Payruns).
            </p>
            <Link href="/dashboard" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Return to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', color: 'var(--text-main)' }}>
      <Navbar />

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Navigation Back */}
        <Link
          href="/payroll/payruns"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1.5rem' }}
        >
          <ArrowLeft size={16} /> Back to Payruns List
        </Link>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            Create New Payroll Run
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Follow the two-step wizard to configure period settings and select eligible employees.
          </p>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{
            flex: 1,
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            background: step === 1 ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card)',
            border: step === 1 ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <div style={{
              width: '2.25rem',
              height: '2.25rem',
              borderRadius: '50%',
              background: step === 1 ? 'var(--primary)' : step > 1 ? 'var(--green)' : 'var(--border-glass)',
              color: step === 1 || step > 1 ? '#FFF' : 'var(--text-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700
            }}>
              {step > 1 ? <Check size={18} /> : 1}
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Step 1</span>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: step === 1 ? 'var(--primary)' : 'var(--text-muted)' }}>
                Payroll Configuration
              </h4>
            </div>
          </div>

          <ArrowRight size={20} color="var(--text-dim)" />

          <div style={{
            flex: 1,
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            background: step === 2 ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card)',
            border: step === 2 ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <div style={{
              width: '2.25rem',
              height: '2.25rem',
              borderRadius: '50%',
              background: step === 2 ? 'var(--primary)' : 'var(--border-glass)',
              color: step === 2 ? '#FFF' : 'var(--text-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700
            }}>
              2
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Step 2</span>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: step === 2 ? 'var(--primary)' : 'var(--text-muted)' }}>
                Employee Selection
              </h4>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1 FORM */}
        {step === 1 && (
          <form onSubmit={handleProceedToStep2} className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              <Layers size={18} color="var(--primary)" /> Configure Payroll Parameters
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
              <div>
                <label className="form-label">Payrun Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. October 2026 Payroll Run"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Period Start Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={periodStart}
                    onChange={e => setPeriodStart(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Period End Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={periodEnd}
                    onChange={e => setPeriodEnd(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Salary Structure *</label>
                <select
                  className="form-input"
                  value={salaryStructureId}
                  onChange={e => setSalaryStructureId(e.target.value)}
                  required
                >
                  {structures.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.rule_count} rules)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Filter Department (Optional)</label>
                  <select
                    className="form-input"
                    value={departmentId}
                    onChange={e => setDepartmentId(e.target.value)}
                  >
                    <option value="">All Departments</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Filter Employment Type (Optional)</label>
                  <select
                    className="form-input"
                    value={employeeTypeFilter}
                    onChange={e => setEmployeeTypeFilter(e.target.value)}
                  >
                    <option value="">All Employment Types</option>
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="intern">Intern</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={fetchingEmployees}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {fetchingEmployees ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} /> Loading Eligible Employees...
                  </>
                ) : (
                  <>
                    Next: Select Employees <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2 EMPLOYEE SELECTION */}
        {step === 2 && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                  <Users size={18} color="var(--primary)" /> Select Employees for {name}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                  Explicitly check the employees to include. Employees without applicable contracts are highlighted and disabled.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={handleSelectAllValid}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                >
                  Select All Eligible
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Selection Counter */}
            <div style={{ background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)' }}>
                {selectedEmpIds.length} of {eligibleEmployees.length} employees selected
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {eligibleEmployees.filter(e => !e.has_applicable_contract).length} ineligible (no contract)
              </span>
            </div>

            {/* Employee Table */}
            <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 0.5rem', width: '40px' }}>Include</th>
                    <th style={{ padding: '0.75rem' }}>Code</th>
                    <th style={{ padding: '0.75rem' }}>Employee Name</th>
                    <th style={{ padding: '0.75rem' }}>Department</th>
                    <th style={{ padding: '0.75rem' }}>Type</th>
                    <th style={{ padding: '0.75rem' }}>Contract Status</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibleEmployees.map(emp => {
                    const isSelected = selectedEmpIds.includes(emp.id);
                    return (
                      <tr
                        key={emp.id}
                        style={{
                          borderBottom: '1px solid var(--border-glass)',
                          background: !emp.has_applicable_contract ? 'var(--red-bg)' : isSelected ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
                          cursor: emp.has_applicable_contract ? 'pointer' : 'not-allowed'
                        }}
                        onClick={() => toggleEmployeeSelect(emp.id, emp.has_applicable_contract)}
                      >
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!emp.has_applicable_contract}
                            onChange={() => toggleEmployeeSelect(emp.id, emp.has_applicable_contract)}
                            onClick={e => e.stopPropagation()}
                            style={{ width: '16px', height: '16px', cursor: emp.has_applicable_contract ? 'pointer' : 'not-allowed' }}
                          />
                        </td>
                        <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {emp.employee_number}
                        </td>
                        <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {emp.first_name} {emp.last_name}
                        </td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                          {emp.department_name || 'Unassigned'}
                        </td>
                        <td style={{ padding: '0.75rem', textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                          {emp.employee_type.replace('_', ' ')}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {emp.has_applicable_contract ? (
                            <span className="badge" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)', fontSize: '0.75rem' }}>
                              <CheckCircle size={10} style={{ marginRight: '3px' }} /> {emp.contract_name || 'Active Contract'}
                            </span>
                          ) : (
                            <span className="badge" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)', fontSize: '0.75rem' }}>
                              <ShieldAlert size={10} style={{ marginRight: '3px' }} /> No Applicable Contract
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Step 2 Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid var(--border-glass)' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <ArrowLeft size={16} /> Back to Configuration
              </button>

              <button
                type="button"
                onClick={handleCreatePayrun}
                disabled={submitting || selectedEmpIds.length === 0}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} /> Creating Payrun...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} /> Create Payrun ({selectedEmpIds.length} Selected)
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
