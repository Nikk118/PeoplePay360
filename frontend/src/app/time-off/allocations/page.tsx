'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
  PieChart, Plus, CheckCircle, XCircle, Calendar, ArrowLeft, Filter, User 
} from 'lucide-react';

interface Allocation {
  id: string;
  employee_id: string;
  employee_name?: string;
  time_off_type_id: string;
  time_off_type_name?: string;
  allocated_days: number;
  taken_days: number;
  remaining_days: number;
  date_from: string;
  date_to: string;
  status: string;
  notes?: string;
}

interface TimeOffType {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

export default function AllocationsPage() {
  return (
    <React.Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading allocations...</div>}>
      <AllocationsContent />
    </React.Suspense>
  );
}

function AllocationsContent() {
  const searchParams = useSearchParams();
  const filterEmpId = searchParams.get('employee_id');

  const { hasRole } = useAuth();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [selectedEmp, setSelectedEmp] = useState(filterEmpId || '');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: filterEmpId || '',
    time_off_type_id: '',
    allocated_days: 20,
    date_from: '2026-01-01',
    date_to: '2026-12-31',
    notes: 'Annual leave allocation 2026'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      let query = `/time-off/allocations?`;
      if (selectedEmp) query += `employee_id=${selectedEmp}&`;
      if (selectedStatus) query += `status=${selectedStatus}&`;

      const [aRes, tRes, eRes] = await Promise.all([
        apiRequest<Allocation[]>(query),
        apiRequest<TimeOffType[]>('/time-off/types'),
        apiRequest<Employee[]>('/employees')
      ]);

      setAllocations(aRes);
      setTypes(tRes);
      setEmployees(eRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedEmp, selectedStatus]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/time-off/allocations', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create allocation');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await apiRequest(`/time-off/allocations/${id}/approve`, { method: 'PUT' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve allocation');
    }
  };

  const handleRefuse = async (id: string) => {
    try {
      await apiRequest(`/time-off/allocations/${id}/refuse`, { method: 'PUT' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to refuse allocation');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
      <Navbar />

      <main style={{ maxWidth: '1280px', margin: '2rem auto', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Time Off Allocations
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Grant and manage employee leave balances per type and validity period
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link href="/time-off/requests" className="btn-secondary">
              <Calendar size={16} /> Leave Requests
            </Link>

            {hasRole(['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin']) && (
              <button onClick={() => {
                setFormData({
                  employee_id: selectedEmp || (employees.length > 0 ? employees[0].id : ''),
                  time_off_type_id: types.length > 0 ? types[0].id : '',
                  allocated_days: 20,
                  date_from: '2026-01-01',
                  date_to: '2026-12-31',
                  notes: 'Annual leave allocation 2026'
                });
                setShowModal(true);
              }} className="btn-primary">
                <Plus size={18} /> New Allocation
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="form-select">
              <option value="">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
          </div>

          <div style={{ width: '200px' }}>
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="form-select">
              <option value="">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="draft">Draft</option>
              <option value="refused">Refused</option>
            </select>
          </div>
        </div>

        {/* Allocations Table */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Leave Type</th>
                <th>Allocated</th>
                <th>Used</th>
                <th>Remaining Balance</th>
                <th>Validity Period</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>Loading allocations...</td></tr>
              ) : allocations.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>No allocation records found.</td></tr>
              ) : (
                allocations.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{a.employee_name || '—'}</div>
                    </td>
                    <td>
                      <span className="badge badge-computed">{a.time_off_type_name}</span>
                    </td>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{a.allocated_days} days</td>
                    <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{a.taken_days} days</td>
                    <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>{a.remaining_days} days</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{a.date_from} to {a.date_to}</td>
                    <td>
                      <span className={`badge badge-${a.status}`}>
                        {a.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {a.status === 'draft' && hasRole(['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin']) ? (
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button onClick={() => handleApprove(a.id)} className="btn-success" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>
                            <CheckCircle size={14} /> Approve
                          </button>
                          <button onClick={() => handleRefuse(a.id)} className="btn-danger" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>
                            <XCircle size={14} /> Refuse
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>—</div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal for Creating Allocation */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
                Grant Leave Allocation
              </h2>

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Employee *</label>
                  <select required value={formData.employee_id} onChange={e => setFormData({...formData, employee_id: e.target.value})} className="form-select">
                    {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Leave Type *</label>
                  <select required value={formData.time_off_type_id} onChange={e => setFormData({...formData, time_off_type_id: e.target.value})} className="form-select">
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Allocated Days *</label>
                  <input type="number" required value={formData.allocated_days} onChange={e => setFormData({...formData, allocated_days: parseFloat(e.target.value)})} className="form-input" style={{ fontFamily: 'var(--font-mono)' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Validity From *</label>
                    <input type="date" required value={formData.date_from} onChange={e => setFormData({...formData, date_from: e.target.value})} className="form-input" />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Validity To *</label>
                    <input type="date" required value={formData.date_to} onChange={e => setFormData({...formData, date_to: e.target.value})} className="form-input" />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Notes</label>
                  <input type="text" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="form-input" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Create Allocation
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
