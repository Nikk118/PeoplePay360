'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
  Clock, LogIn, LogOut, CheckCircle, AlertTriangle, Filter, Plus, Calendar, User, FileText, Search 
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name?: string;
  department_name?: string;
  check_in: string;
  check_out?: string;
  worked_hours: number;
  status: string;
  is_manual_edit: boolean;
  notes?: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

interface Department {
  id: string;
  name: string;
}

export default function AttendancePage() {
  return (
    <React.Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading attendance module...</div>}>
      <AttendanceContent />
    </React.Suspense>
  );
}

function AttendanceContent() {
  const searchParams = useSearchParams();
  const filterEmpId = searchParams.get('employee_id');

  const { user, hasRole } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);

  const [selectedEmp, setSelectedEmp] = useState(filterEmpId || '');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Manual Correction Modal
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [formData, setFormData] = useState({
    employee_id: filterEmpId || '',
    check_in: new Date().toISOString().slice(0, 16),
    check_out: '',
    status: 'present',
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      let query = `/attendance?`;
      if (selectedEmp) query += `employee_id=${selectedEmp}&`;
      if (selectedDept) query += `department_id=${selectedDept}&`;
      if (selectedStatus) query += `status=${selectedStatus}&`;

      const [attRes, empRes, deptRes, todayRes] = await Promise.all([
        apiRequest<AttendanceRecord[]>(query),
        apiRequest<Employee[]>('/employees'),
        apiRequest<Department[]>('/departments'),
        apiRequest<AttendanceRecord | null>('/attendance/today').catch(() => null)
      ]);

      setAttendance(attRes);
      setEmployees(empRes);
      setDepartments(deptRes);
      setTodayRecord(todayRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedEmp, selectedDept, selectedStatus]);

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      await apiRequest('/attendance/check-in', { method: 'POST' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to check in');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayRecord) return;
    setActionLoading(true);
    try {
      await apiRequest(`/attendance/check-out/${todayRecord.id}`, { method: 'PUT' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to check out');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editRecord) {
        // Update existing
        await apiRequest(`/attendance/${editRecord.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            check_in: formData.check_in,
            check_out: formData.check_out || null,
            status: formData.status,
            notes: formData.notes
          })
        });
      } else {
        // Create manual entry
        await apiRequest('/attendance', {
          method: 'POST',
          body: JSON.stringify({
            employee_id: formData.employee_id,
            check_in: formData.check_in,
            check_out: formData.check_out || null,
            status: formData.status,
            notes: formData.notes
          })
        });
      }
      setShowModal(false);
      setEditRecord(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save attendance record');
    }
  };

  const openEditModal = (rec: AttendanceRecord) => {
    setEditRecord(rec);
    setFormData({
      employee_id: rec.employee_id,
      check_in: new Date(rec.check_in).toISOString().slice(0, 16),
      check_out: rec.check_out ? new Date(rec.check_out).toISOString().slice(0, 16) : '',
      status: rec.status,
      notes: rec.notes || ''
    });
    setShowModal(true);
  };

  const openNewModal = () => {
    setEditRecord(null);
    setFormData({
      employee_id: selectedEmp || (employees.length > 0 ? employees[0].id : ''),
      check_in: new Date().toISOString().slice(0, 16),
      check_out: '',
      status: 'present',
      notes: ''
    });
    setShowModal(true);
  };

  // Metrics calculation
  const totalWorkedHours = attendance.reduce((sum, r) => sum + (r.worked_hours || 0), 0);
  const presentCount = attendance.filter(r => r.status === 'present').length;
  const lateCount = attendance.filter(r => r.status === 'late').length;
  const halfDayCount = attendance.filter(r => r.status === 'half_day').length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <Navbar />

      <main style={{ maxWidth: '1280px', margin: '2rem auto', padding: '0 1.5rem' }}>
        {/* Header & Quick Action */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Attendance Tracking & Operations
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Daily timestamped check-in/out records, worked hours computation, and exception management
            </p>
          </div>

          {/* Quick Check-In / Check-Out Widget */}
          {user && (
            <div className="glass-card" style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ATTENDANCE QUICK ACTION</div>
                {todayRecord && !todayRecord.check_out ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--green)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CheckCircle size={14} /> Checked in at {new Date(todayRecord.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                ) : todayRecord && todayRecord.check_out ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                    Completed: {todayRecord.worked_hours} hrs today
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                    Not checked in today
                  </div>
                )}
              </div>

              {(!todayRecord || todayRecord.check_out) ? (
                <button onClick={handleCheckIn} disabled={actionLoading} className="btn-success" style={{ padding: '0.6rem 1.25rem' }}>
                  <LogIn size={18} /> {actionLoading ? 'Checking In...' : 'Check In Now'}
                </button>
              ) : (
                <button onClick={handleCheckOut} disabled={actionLoading} className="btn-danger" style={{ padding: '0.6rem 1.25rem' }}>
                  <LogOut size={18} /> {actionLoading ? 'Checking Out...' : 'Check Out'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Attendance Summary Banner */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '1.75rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Records</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.25rem' }}>{attendance.length}</div>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Worked Hours</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--green)', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>{totalWorkedHours.toFixed(1)} hrs</div>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>On-Time Present</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--blue)', marginTop: '0.25rem' }}>{presentCount}</div>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Late / Half-Day Exceptions</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--amber)', marginTop: '0.25rem' }}>{lateCount + halfDayCount}</div>
          </div>
        </div>

        {/* Filter & Action Controls */}
        <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="form-select">
              <option value="">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
          </div>

          <div style={{ width: '200px' }}>
            <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="form-select">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div style={{ width: '180px' }}>
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="form-select">
              <option value="">All Statuses</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="half_day">Half Day</option>
              <option value="absent">Absent</option>
            </select>
          </div>

          {hasRole(['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin']) && (
            <button onClick={openNewModal} className="btn-primary" style={{ padding: '0.65rem 1.25rem' }}>
              <Plus size={16} /> Manual Attendance
            </button>
          )}
        </div>

        {/* Attendance Records Table */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Worked Hours</th>
                <th>Status</th>
                <th>Type</th>
                {hasRole(['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin']) && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>Loading attendance records...</td></tr>
              ) : attendance.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>No attendance entries found.</td></tr>
              ) : (
                attendance.map(rec => {
                  const checkInDate = new Date(rec.check_in);
                  return (
                    <tr key={rec.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {checkInDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{rec.employee_name || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rec.department_name}</div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--primary)' }}>
                        {checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: rec.check_out ? 'var(--green)' : 'var(--text-dim)' }}>
                        {rec.check_out ? new Date(rec.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Active...'}
                      </td>
                      <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                        {rec.worked_hours ? `${rec.worked_hours} hrs` : '0.0 hrs'}
                      </td>
                      <td>
                        <span className={`badge badge-${rec.status === 'present' ? 'active' : rec.status === 'late' ? 'pending' : 'refused'}`}>
                          {rec.status}
                        </span>
                      </td>
                      <td>
                        {rec.is_manual_edit ? (
                          <span className="badge" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid var(--amber-border)', fontSize: '0.7rem' }}>
                            Manual Correction
                          </span>
                        ) : (
                          <span className="badge" style={{ background: '#F1F5F9', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: '0.7rem' }}>
                            System Check-In
                          </span>
                        )}
                      </td>
                      {hasRole(['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin']) && (
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => openEditModal(rec)} className="btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>
                            Edit Entry
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal for Manual Attendance Entry / Correction */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
                {editRecord ? 'Correct Attendance Entry' : 'Create Manual Attendance'}
              </h2>

              <form onSubmit={handleSaveCorrection} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {!editRecord && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Employee *</label>
                    <select required value={formData.employee_id} onChange={e => setFormData({...formData, employee_id: e.target.value})} className="form-select">
                      {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Check In Timestamp *</label>
                  <input type="datetime-local" required value={formData.check_in} onChange={e => setFormData({...formData, check_in: e.target.value})} className="form-input" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Check Out Timestamp</label>
                  <input type="datetime-local" value={formData.check_out} onChange={e => setFormData({...formData, check_out: e.target.value})} className="form-input" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Attendance Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="form-select">
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="half_day">Half Day</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Correction Reason / Notes</label>
                  <input type="text" placeholder="Reason for manual adjustment..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="form-input" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Save Record
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
