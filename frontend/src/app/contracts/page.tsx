'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
  FileText, Plus, Search, Filter, AlertTriangle, CheckCircle, Calendar, DollarSign, User 
} from 'lucide-react';

interface Contract {
  id: string;
  employee_id: string;
  employee_name?: string;
  name: string;
  contract_type?: string;
  department_name?: string;
  job_title?: string;
  date_start: string;
  date_end?: string;
  wage: number;
  wage_type: string;
  salary_structure_id?: string;
  salary_structure_name?: string;
  working_schedule_id?: string;
  schedule_name?: string;
  status: string;
  has_overlap_warning: boolean;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

interface SalaryStructure {
  id: string;
  name: string;
}

interface WorkingSchedule {
  id: string;
  name: string;
}

export default function ContractsPage() {
  return (
    <React.Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading contracts page...</div>}>
      <ContractsContent />
    </React.Suspense>
  );
}

function ContractsContent() {
  const searchParams = useSearchParams();
  const filterEmployeeId = searchParams.get('employee_id');

  const { hasRole } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [schedules, setSchedules] = useState<WorkingSchedule[]>([]);
  
  const [selectedEmployee, setSelectedEmployee] = useState(filterEmployeeId || '');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);

  // Applicable Contract Tester state
  const [testEmpId, setTestEmpId] = useState('');
  const [testPeriodStart, setTestPeriodStart] = useState('2026-09-01');
  const [testPeriodEnd, setTestPeriodEnd] = useState('2026-09-30');
  const [testResult, setTestResult] = useState<any>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: filterEmployeeId || '',
    name: '',
    contract_type: 'permanent',
    job_title: 'Senior Engineer',
    date_start: '2026-01-01',
    date_end: '',
    wage: 60000,
    wage_type: 'monthly',
    salary_structure_id: '',
    working_schedule_id: '',
    status: 'active',
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      let query = `/contracts?`;
      if (selectedEmployee) query += `employee_id=${selectedEmployee}&`;
      if (selectedStatus) query += `status=${selectedStatus}&`;

      const [cRes, eRes, sRes, schRes] = await Promise.all([
        apiRequest<Contract[]>(query),
        apiRequest<Employee[]>('/employees'),
        apiRequest<SalaryStructure[]>('/payroll/structures').catch(() => []),
        apiRequest<WorkingSchedule[]>('/schedules')
      ]);
      setContracts(cRes);
      setEmployees(eRes);
      setStructures(sRes);
      setSchedules(schRes);

      if (!testEmpId && eRes.length > 0) {
        setTestEmpId(eRes[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedEmployee, selectedStatus]);

  const handleTestApplicable = async () => {
    if (!testEmpId) return;
    try {
      const res = await apiRequest(`/contracts/applicable?employee_id=${testEmpId}&period_start=${testPeriodStart}&period_end=${testPeriodEnd}`);
      setTestResult(res);
    } catch (err: any) {
      alert(err.message || 'Failed to query applicable contract');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/contracts', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          date_end: formData.date_end || null,
          salary_structure_id: formData.salary_structure_id || null,
          working_schedule_id: formData.working_schedule_id || null
        })
      });
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create contract');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <Navbar />

      <main style={{ maxWidth: '1280px', margin: '2rem auto', padding: '0 1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Contract Management
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Historical employment contracts & period-based active contract resolution
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link href="/schedules" className="btn-secondary">
              <Calendar size={16} /> Manage Schedules
            </Link>

            {hasRole(['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin']) && (
              <button onClick={() => setShowModal(true)} className="btn-primary">
                <Plus size={18} /> New Contract
              </button>
            )}
          </div>
        </div>

        {/* Period-Based Contract Resolver Interactive Tool */}
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.75rem', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={16} /> Applicable Contract Resolver (Payroll Test Engine)
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Select Employee</label>
              <select value={testEmpId} onChange={e => setTestEmpId(e.target.value)} className="form-select">
                {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Period Start</label>
              <input type="date" value={testPeriodStart} onChange={e => setTestPeriodStart(e.target.value)} className="form-input" />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Period End</label>
              <input type="date" value={testPeriodEnd} onChange={e => setTestPeriodEnd(e.target.value)} className="form-input" />
            </div>

            <button onClick={handleTestApplicable} className="btn-primary" style={{ padding: '0.65rem 1.25rem' }}>
              Resolve Applicable Contract
            </button>
          </div>

          {testResult && (
            <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', background: 'rgba(17, 24, 39, 0.8)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: testResult.applicable_contract ? '#34D399' : '#F87171' }}>
                {testResult.status_message}
              </div>
              {testResult.applicable_contract && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Contract: <strong>{testResult.applicable_contract.name}</strong> • Wage: <strong>₹{testResult.applicable_contract.wage.toLocaleString()}</strong> ({testResult.applicable_contract.wage_type}) • Valid: <strong>{testResult.applicable_contract.date_start}</strong> to <strong>{testResult.applicable_contract.date_end || 'Open-ended'}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} className="form-select">
              <option value="">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
          </div>

          <div style={{ width: '200px' }}>
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="form-select">
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Contracts Table */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Contract Reference</th>
                <th>Employee</th>
                <th>Wage / Rate</th>
                <th>Duration</th>
                <th>Structure</th>
                <th>Schedule</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No contract records found.
                  </td>
                </tr>
              ) : (
                contracts.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{c.name}</div>
                      {c.has_overlap_warning && (
                        <span className="badge badge-refused" style={{ fontSize: '0.65rem', marginTop: '0.25rem' }}>
                          <AlertTriangle size={12} /> Overlapping Active Contract
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{c.employee_name || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.job_title}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                        ₹{c.wage.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                        per {c.wage_type}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div>Start: {c.date_start}</div>
                      <div>End: {c.date_end || 'Open-ended'}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{c.salary_structure_name || 'Regular Salary'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{c.schedule_name || 'Standard 40h'}</td>
                    <td>
                      <span className={`badge badge-${c.status}`}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/contracts/${c.id}`} className="btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>
                        Edit Contract →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal for Creating Contract */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '600px', padding: '2rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
                Issue New Employment Contract
              </h2>

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Employee *</label>
                    <select required value={formData.employee_id} onChange={e => setFormData({...formData, employee_id: e.target.value})} className="form-select">
                      <option value="">Select Employee</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Contract Title *</label>
                    <input type="text" required placeholder="e.g. Senior Dev Contract 2026" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="form-input" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Contract Wage (Base Salary) *</label>
                    <input type="number" required value={formData.wage} onChange={e => setFormData({...formData, wage: parseFloat(e.target.value)})} className="form-input" />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Wage Type</label>
                    <select value={formData.wage_type} onChange={e => setFormData({...formData, wage_type: e.target.value})} className="form-select">
                      <option value="monthly">Monthly</option>
                      <option value="hourly">Hourly</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Start Date *</label>
                    <input type="date" required value={formData.date_start} onChange={e => setFormData({...formData, date_start: e.target.value})} className="form-input" />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>End Date (Leave blank for open-ended)</label>
                    <input type="date" value={formData.date_end} onChange={e => setFormData({...formData, date_end: e.target.value})} className="form-input" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Working Schedule</label>
                    <select value={formData.working_schedule_id} onChange={e => setFormData({...formData, working_schedule_id: e.target.value})} className="form-select">
                      <option value="">Use Default Schedule</option>
                      {schedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Contract Status</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="form-select">
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                      <option value="expired">Expired</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Create Contract
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
