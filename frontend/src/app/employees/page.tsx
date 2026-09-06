'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
  Users, LayoutGrid, List as ListIcon, Plus, Search, Filter, Mail, Phone, Building, Briefcase 
} from 'lucide-react';

interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  department_id?: string;
  department_name?: string;
  job_title?: string;
  job_position?: string;
  employee_type: string;
  status: string;
}

interface Department {
  id: string;
  name: string;
}

export default function EmployeesPage() {
  const { user, hasRole } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('list');
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(true);

  // Check if current user is purely an employee (no HR/Admin roles)
  const isEmployeeOnly = user ? (!user.roles.some(r => ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'].includes(r)) && user.roles.includes('employee')) : false;

  // New Employee Modal state
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    employee_number: `EMP${Math.floor(100 + Math.random() * 900)}`,
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department_id: '',
    job_title: '',
    employee_type: 'full_time',
    status: 'active'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      if (isEmployeeOnly) {
        // Employee role only fetches their own record via object-authorized endpoint
        const empRes = await apiRequest<Employee[]>('/employees');
        setEmployees(empRes || []);
      } else {
        let query = `/employees?`;
        if (search) query += `search=${encodeURIComponent(search)}&`;
        if (selectedDept) query += `department_id=${selectedDept}&`;
        
        const [empRes, deptRes] = await Promise.all([
          apiRequest<Employee[]>(query),
          apiRequest<Department[]>('/departments')
        ]);
        setEmployees(empRes || []);
        setDepartments(deptRes || []);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedDept, isEmployeeOnly]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/employees', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setShowModal(false);
      setFormData({
        employee_number: `EMP${Math.floor(100 + Math.random() * 900)}`,
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        department_id: '',
        job_title: '',
        employee_type: 'full_time',
        status: 'active'
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create employee');
    }
  };

  const activeEmployees = employees.filter(e => e.status === 'active');

  // Dedicated Employee View: shows ONLY the logged-in employee's own profile without search/directory/actions
  if (isEmployeeOnly) {
    const myProfile = employees.length > 0 ? employees[0] : null;

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
        <Navbar />

        <main style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1.5rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              My Employee Profile
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Your personal employment and organization profile
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              Loading your employee profile...
            </div>
          ) : !myProfile ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--red)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem'
              }}>
                <Users size={28} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                Employee profile not found
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto' }}>
                Your user account is not currently linked to an active employee profile. Please contact your organization administrator or HR team.
              </p>
            </div>
          ) : (
            <div>
              {/* Profile Card Header */}
              <div className="glass-card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{
                    width: '4.5rem',
                    height: '4.5rem',
                    borderRadius: '1rem',
                    background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFF',
                    fontWeight: 800,
                    fontSize: '1.75rem'
                  }}>
                    {myProfile.first_name?.[0]}{myProfile.last_name?.[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                        {myProfile.first_name} {myProfile.last_name}
                      </h2>
                      <span className={`badge badge-${myProfile.status}`} style={{ textTransform: 'capitalize' }}>
                        {myProfile.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '0.5rem', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      <span><strong>ID:</strong> {myProfile.employee_number}</span>
                      <span><strong>Role:</strong> {myProfile.job_title || 'Employee'}</span>
                      <span><strong>Department:</strong> {myProfile.department_name || 'Unassigned'}</span>
                    </div>
                  </div>
                  <div>
                    <Link
                      href={`/employees/${myProfile.id}`}
                      className="btn-primary"
                      style={{ textDecoration: 'none', padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                    >
                      View Operational Hub →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Detail Sections Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {/* Employment Information */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Briefcase size={18} color="var(--primary)" /> Employment Information
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.875rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>Department</span>
                      <strong style={{ color: 'var(--text-main)' }}>{myProfile.department_name || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>Job Title</span>
                      <strong style={{ color: 'var(--text-main)' }}>{myProfile.job_title || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>Job Position</span>
                      <strong style={{ color: 'var(--text-main)' }}>{myProfile.job_position || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>Employment Type</span>
                      <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', textTransform: 'capitalize' }}>
                        {myProfile.employee_type?.replace('_', ' ') || 'Full Time'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Mail size={18} color="var(--primary)" /> Contact Details
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.875rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>Email</span>
                      <strong style={{ color: 'var(--text-main)' }}>{myProfile.email || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>Phone</span>
                      <strong style={{ color: 'var(--text-main)' }}>{myProfile.phone || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>Employee Number</span>
                      <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{myProfile.employee_number}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Admin / HR View: Central Employee Directory
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <Navbar />

      <main style={{ maxWidth: '1280px', margin: '2rem auto', padding: '0 1.5rem' }}>
        {/* Header Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Employee Directory
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Central hub for employee master data, contracts, attendance, and leave management
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* View Switcher */}
            <div style={{
              background: '#E2E8F0',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.2rem',
              display: 'flex',
              gap: '0.2rem'
            }}>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  background: viewMode === 'list' ? 'var(--primary)' : 'transparent',
                  color: viewMode === 'list' ? '#FFF' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.4rem 0.65rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
              >
                <ListIcon size={15} /> List
              </button>

              <button
                onClick={() => setViewMode('kanban')}
                style={{
                  background: viewMode === 'kanban' ? 'var(--primary)' : 'transparent',
                  color: viewMode === 'kanban' ? '#FFF' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.4rem 0.65rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
              >
                <LayoutGrid size={15} /> Kanban
              </button>
            </div>

            {hasRole('admin') && (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                <Plus size={18} /> Add Employee
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.75rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by name, number, job title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <div style={{ width: '220px' }}>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="form-select"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Views */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading employee records...
          </div>
        ) : viewMode === 'list' ? (
          /* List View */
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Emp #</th>
                  <th>Department</th>
                  <th>Job Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No employee records found.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <Link href={`/employees/${emp.id}`} style={{ textDecoration: 'none', color: 'var(--text-main)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div style={{
                            width: '2rem',
                            height: '2rem',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            color: '#FFF'
                          }}>
                            {emp.first_name[0]}{emp.last_name[0]}
                          </div>
                          {emp.first_name} {emp.last_name}
                        </Link>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {emp.employee_number}
                      </td>
                      <td>{emp.department_name || '—'}</td>
                      <td>{emp.job_title || '—'}</td>
                      <td>
                        <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', textTransform: 'capitalize' }}>
                          {emp.employee_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${emp.status}`}>
                          {emp.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link href={`/employees/${emp.id}`} className="btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>
                          View Hub →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Kanban View */
          <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem', overflowX: 'auto' }}>
            {/* Active Column */}
            <div style={{ background: '#F1F5F9', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Active ({activeEmployees.length})
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', gap: '0.85rem' }}>
                
                {activeEmployees.map(emp => (
                  <Link key={emp.id} href={`/employees/${emp.id}`} style={{ textDecoration: 'none' }}>
                    <div className="glass-card" style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', background: 'linear-gradient(135deg, #3B82F6, #06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontWeight: 700 }}>
                          {emp.first_name[0]}{emp.last_name[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{emp.first_name} {emp.last_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.job_title || 'No Title'}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <Building size={13} /> {emp.department_name || 'Unassigned'}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

           
          </div>
        )}

        {/* Modal for Creating Employee */}
        {showModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem'
          }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '550px', padding: '2rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
                Add New Employee Record
              </h2>

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>First Name *</label>
                    <input type="text" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="form-input" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Last Name *</label>
                    <input type="text" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="form-input" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Employee # *</label>
                    <input type="text" required value={formData.employee_number} onChange={e => setFormData({...formData, employee_number: e.target.value})} className="form-input" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Department</label>
                    <select value={formData.department_id} onChange={e => setFormData({...formData, department_id: e.target.value})} className="form-select">
                      <option value="">Select Department</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Email</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="form-input" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Job Title</label>
                    <input type="text" value={formData.job_title} onChange={e => setFormData({...formData, job_title: e.target.value})} className="form-input" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Employee Type</label>
                    <select value={formData.employee_type} onChange={e => setFormData({...formData, employee_type: e.target.value})} className="form-select">
                      <option value="full_time">Full Time</option>
                      <option value="part_time">Part Time</option>
                      <option value="contract">Contract</option>
                      <option value="intern">Intern</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Status</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="form-select">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Create Record
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
