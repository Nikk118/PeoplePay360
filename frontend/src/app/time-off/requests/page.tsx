'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, Plus, CheckCircle, XCircle, Clock, PieChart, Tag, Filter, User, AlertCircle 
} from 'lucide-react';

interface TimeOffRequest {
  id: string;
  employee_id: string;
  employee_name?: string;
  department_name?: string;
  time_off_type_id: string;
  time_off_type_name?: string;
  time_off_type_code?: string;
  date_from: string;
  date_to: string;
  duration_days: number;
  reason?: string;
  status: string;
  approved_by_name?: string;
}

interface LeaveBalance {
  employee_id: string;
  time_off_type_id: string;
  type_name: string;
  type_code: string;
  allocated_days: number;
  taken_days: number;
  remaining_days: number;
  requires_allocation: boolean;
}

interface TimeOffType {
  id: string;
  name: string;
  code: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

export default function TimeOffRequestsPage() {
  return (
    <React.Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading leave management...</div>}>
      <TimeOffRequestsContent />
    </React.Suspense>
  );
}

function TimeOffRequestsContent() {
  const searchParams = useSearchParams();
  const filterEmpId = searchParams.get('employee_id');

  const { user, hasRole } = useAuth();
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [selectedEmp, setSelectedEmp] = useState(filterEmpId || '');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);

  // New Request Modal state
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: filterEmpId || '',
    time_off_type_id: '',
    date_from: '2026-09-15',
    date_to: '2026-09-17',
    reason: 'Personal leave'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      let reqQuery = `/time-off/requests?`;
      if (selectedEmp) reqQuery += `employee_id=${selectedEmp}&`;
      if (selectedStatus) reqQuery += `status=${selectedStatus}&`;

      const [rRes, tRes, eRes] = await Promise.all([
        apiRequest<TimeOffRequest[]>(reqQuery),
        apiRequest<TimeOffType[]>('/time-off/types'),
        apiRequest<Employee[]>('/employees')
      ]);

      setRequests(rRes);
      setTypes(tRes);
      setEmployees(eRes);

      const targetEmp = selectedEmp || (user?.employee_id ? user.employee_id : (eRes.length > 0 ? eRes[0].id : ''));
      if (targetEmp) {
        const bRes = await apiRequest<LeaveBalance[]>(`/time-off/balances?employee_id=${targetEmp}`);
        setBalances(bRes);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedEmp, selectedStatus]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/time-off/requests', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          employee_id: formData.employee_id || user?.employee_id
        })
      });
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit leave request');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await apiRequest(`/time-off/requests/${id}/approve`, { method: 'PUT' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve request');
    }
  };

  const handleRefuse = async (id: string) => {
    try {
      await apiRequest(`/time-off/requests/${id}/refuse`, { method: 'PUT' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to refuse request');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
      <Navbar />

      <main style={{ maxWidth: '1280px', margin: '2rem auto', padding: '0 1.5rem' }}>
        {/* Navigation & Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Time Off Requests & Approvals
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Employee leave requests, HR approvals, and real-time allocation balance management
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link href="/time-off/allocations" className="btn-secondary">
              <PieChart size={16} /> Allocations
            </Link>

            <Link href="/time-off/types" className="btn-secondary">
              <Tag size={16} /> Leave Types
            </Link>

            <button onClick={() => {
              setFormData({
                employee_id: selectedEmp || (user?.employee_id ? user.employee_id : (employees.length > 0 ? employees[0].id : '')),
                time_off_type_id: types.length > 0 ? types[0].id : '',
                date_from: '2026-09-15',
                date_to: '2026-09-17',
                reason: 'Personal leave'
              });
              setShowModal(true);
            }} className="btn-primary">
              <Plus size={18} /> Request Time Off
            </button>
          </div>
        </div>

        {/* Leave Balances Display Bar */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Leave Balance Overview ({selectedEmp ? 'Selected Employee' : 'My Balances'})
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {balances.map(b => (
              <div key={b.time_off_type_id} className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{b.type_name}</span>
                  <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>{b.type_code}</span>
                </div>

                {b.requires_allocation ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem' }}>
                    <div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                        {b.remaining_days} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>days remaining</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                        Allocated: {b.allocated_days}d • Used: {b.taken_days}d
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--primary)', marginTop: '0.5rem', fontWeight: 600 }}>
                    No allocation required (Payroll affected)
                  </div>
                )}
              </div>
            ))}
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
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="refused">Refused</option>
            </select>
          </div>
        </div>

        {/* Requests Table */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Leave Type</th>
                <th>Duration</th>
                <th>Dates</th>
                <th>Reason</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions / Approver</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>Loading leave requests...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>No time off requests found.</td></tr>
              ) : (
                requests.map(req => {
                  const isOwnRequest = Boolean(user?.employee_id && user.employee_id === req.employee_id);
                  const canApprove = hasRole(['hr_manager', 'hr_payroll_manager', 'admin']) && !(isOwnRequest && !user?.roles.includes('admin'));

                  return (
                    <tr key={req.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{req.employee_name || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{req.department_name}</div>
                      </td>
                      <td>
                        <span className="badge badge-computed">{req.time_off_type_name}</span>
                      </td>
                      <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>
                        {req.duration_days} {req.duration_days === 1 ? 'day' : 'days'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {req.date_from} to {req.date_to}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        {req.reason || '—'}
                      </td>
                      <td>
                        <span className={`badge badge-${req.status}`}>
                          {req.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {req.status === 'pending' && canApprove ? (
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            <button onClick={() => handleApprove(req.id)} className="btn-success" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>
                              <CheckCircle size={14} /> Approve
                            </button>
                            <button onClick={() => handleRefuse(req.id)} className="btn-danger" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>
                              <XCircle size={14} /> Refuse
                            </button>
                          </div>
                        ) : req.status === 'pending' && isOwnRequest ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                            Awaiting Review
                          </span>
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            {req.approved_by_name ? `By ${req.approved_by_name}` : '—'}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal for Submitting Request */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
                Submit Time Off Request
              </h2>

              <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Employee *</label>
                  <select required value={formData.employee_id} onChange={e => setFormData({...formData, employee_id: e.target.value})} className="form-select">
                    {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Leave Type *</label>
                  <select required value={formData.time_off_type_id} onChange={e => setFormData({...formData, time_off_type_id: e.target.value})} className="form-select">
                    {types.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Start Date *</label>
                    <input type="date" required value={formData.date_from} onChange={e => setFormData({...formData, date_from: e.target.value})} className="form-input" />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>End Date *</label>
                    <input type="date" required value={formData.date_to} onChange={e => setFormData({...formData, date_to: e.target.value})} className="form-input" />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Reason / Notes</label>
                  <input type="text" placeholder="Reason for request..." value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} className="form-input" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Submit Request
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
