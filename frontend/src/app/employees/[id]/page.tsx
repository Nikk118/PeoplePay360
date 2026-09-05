'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
  User, FileText, Clock, Calendar, PieChart, Building, CreditCard, Save, ArrowLeft, Shield 
} from 'lucide-react';

interface EmployeeDetail {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  marital_status?: string;
  nationality?: string;
  address?: string;
  department_id?: string;
  department_name?: string;
  manager_id?: string;
  manager_name?: string;
  job_title?: string;
  job_position?: string;
  employee_type: string;
  working_schedule_id?: string;
  schedule_name?: string;
  status: string;
  hire_date?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_name?: string;
}

interface Stats {
  contracts_count: number;
  attendance_count: number;
  time_off_count: number;
  allocations_count: number;
}

interface Department {
  id: string;
  name: string;
}

export default function EmployeeHubPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { hasRole } = useAuth();

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [stats, setStats] = useState<Stats>({ contracts_count: 0, attendance_count: 0, time_off_count: 0, allocations_count: 0 });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      const [empData, statsData, deptData] = await Promise.all([
        apiRequest<EmployeeDetail>(`/employees/${id}`),
        apiRequest<Stats>(`/employees/${id}/stats`),
        apiRequest<Department[]>('/departments')
      ]);
      setEmployee(empData);
      setStats(statsData);
      setDepartments(deptData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setSaving(true);
    setSuccessMsg('');
    try {
      await apiRequest(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(employee)
      });
      setSuccessMsg('Employee hub updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save employee changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !employee) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
        <Navbar />
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading employee operational hub...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Navbar />

      <main style={{ maxWidth: '1280px', margin: '2rem auto', padding: '0 1.5rem' }}>
        {/* Navigation Back */}
        <Link href="/employees" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          <ArrowLeft size={16} /> Back to Directory
        </Link>

        {/* Top Header Card */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{
                width: '4rem',
                height: '4rem',
                borderRadius: '1.25rem',
                background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#FFF',
                boxShadow: '0 8px 24px rgba(59, 130, 246, 0.35)'
              }}>
                {employee.first_name[0]}{employee.last_name[0]}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#FFF' }}>
                    {employee.first_name} {employee.last_name}
                  </h1>
                  <span className={`badge badge-${employee.status}`}>
                    {employee.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {employee.job_title || 'No Job Title'} • {employee.department_name || 'No Department'} • <span style={{ fontFamily: 'var(--font-mono)' }}>{employee.employee_number}</span>
                </div>
              </div>
            </div>

            {/* Smart Action Buttons Navigation */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link href={`/contracts?employee_id=${employee.id}`} className="btn-secondary" style={{ padding: '0.6rem 0.9rem', gap: '0.5rem' }}>
                <FileText size={16} color="#60A5FA" />
                <span>Contracts</span>
                <span className="badge badge-computed" style={{ fontSize: '0.7rem' }}>{stats.contracts_count}</span>
              </Link>

              <Link href={`/attendance?employee_id=${employee.id}`} className="btn-secondary" style={{ padding: '0.6rem 0.9rem', gap: '0.5rem' }}>
                <Clock size={16} color="#34D399" />
                <span>Attendance</span>
                <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>{stats.attendance_count}</span>
              </Link>

              <Link href={`/time-off/requests?employee_id=${employee.id}`} className="btn-secondary" style={{ padding: '0.6rem 0.9rem', gap: '0.5rem' }}>
                <Calendar size={16} color="#FBBF24" />
                <span>Time Off</span>
                <span className="badge badge-pending" style={{ fontSize: '0.7rem' }}>{stats.time_off_count}</span>
              </Link>

              <Link href={`/time-off/allocations?employee_id=${employee.id}`} className="btn-secondary" style={{ padding: '0.6rem 0.9rem', gap: '0.5rem' }}>
                <PieChart size={16} color="#A78BFA" />
                <span>Allocations</span>
                <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#C084FC', fontSize: '0.7rem' }}>{stats.allocations_count}</span>
              </Link>
            </div>
          </div>
        </div>

        {successMsg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34D399', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {successMsg}
          </div>
        )}

        {/* Master Form */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Section 1: Personal Information */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFF', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={18} color="#3B82F6" /> Personal Details
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>First Name</label>
                <input type="text" value={employee.first_name} onChange={e => setEmployee({...employee, first_name: e.target.value})} className="form-input" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Last Name</label>
                <input type="text" value={employee.last_name} onChange={e => setEmployee({...employee, last_name: e.target.value})} className="form-input" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Email Address</label>
                <input type="email" value={employee.email || ''} onChange={e => setEmployee({...employee, email: e.target.value})} className="form-input" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Phone Number</label>
                <input type="text" value={employee.phone || ''} onChange={e => setEmployee({...employee, phone: e.target.value})} className="form-input" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Gender</label>
                <select value={employee.gender || 'male'} onChange={e => setEmployee({...employee, gender: e.target.value})} className="form-select">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Marital Status</label>
                <select value={employee.marital_status || 'single'} onChange={e => setEmployee({...employee, marital_status: e.target.value})} className="form-select">
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Employment & Work Assignment */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFF', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building size={18} color="#10B981" /> Employment & Organizational Structure
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Employee Number</label>
                <input type="text" value={employee.employee_number} onChange={e => setEmployee({...employee, employee_number: e.target.value})} className="form-input" style={{ fontFamily: 'var(--font-mono)' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Department</label>
                <select value={employee.department_id || ''} onChange={e => setEmployee({...employee, department_id: e.target.value})} className="form-select">
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Job Title</label>
                <input type="text" value={employee.job_title || ''} onChange={e => setEmployee({...employee, job_title: e.target.value})} className="form-input" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Employee Type</label>
                <select value={employee.employee_type} onChange={e => setEmployee({...employee, employee_type: e.target.value})} className="form-select">
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Employment Status</label>
                <select value={employee.status} onChange={e => setEmployee({...employee, status: e.target.value})} className="form-select">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Working Schedule</label>
                <input type="text" disabled value={employee.schedule_name || 'Standard 40h (Mon-Fri)'} className="form-input" style={{ opacity: 0.7 }} />
              </div>
            </div>
          </div>

          {/* Section 3: Banking & Payroll Information */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFF', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={18} color="#F59E0B" /> Banking & Disbursal Information
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Bank Name</label>
                <input type="text" placeholder="e.g. HDFC Bank" value={employee.bank_name || ''} onChange={e => setEmployee({...employee, bank_name: e.target.value})} className="form-input" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Account Number</label>
                <input type="text" placeholder="12-digit account number" value={employee.bank_account_number || ''} onChange={e => setEmployee({...employee, bank_account_number: e.target.value})} className="form-input" style={{ fontFamily: 'var(--font-mono)' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Beneficiary Name</label>
                <input type="text" placeholder="Account Holder Name" value={employee.bank_account_name || ''} onChange={e => setEmployee({...employee, bank_account_name: e.target.value})} className="form-input" />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          {hasRole(['hr_manager', 'admin']) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '0.75rem 1.75rem' }}>
                <Save size={18} /> {saving ? 'Saving...' : 'Save Hub Changes'}
              </button>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
