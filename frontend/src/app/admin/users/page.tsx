'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import {
  Users, Shield, Plus, RefreshCw, CheckCircle,
  AlertCircle, Mail, UserCheck
} from 'lucide-react';

interface AppUserRecord {
  id: string;
  email: string;
  employee_id?: string;
  employee_name?: string;
  is_active: boolean;
  roles: string[];
}

interface EmployeeOption {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email?: string;
}

export default function AdminUsersPage() {
  const { user, hasRole } = useAuth();
  const [users, setUsers] = useState<AppUserRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form Fields
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('hr_payroll_user');
  const [accountStatus, setAccountStatus] = useState<boolean>(true);

  useEffect(() => {
    fetchUsersAndEmployees();
  }, []);

  const fetchUsersAndEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, empData] = await Promise.all([
        apiRequest<AppUserRecord[]>('/users'),
        apiRequest<EmployeeOption[]>('/employees').catch(() => [])
      ]);
      setUsers(usersData);
      setEmployees(empData);
    } catch (err: any) {
      setError(err.message || 'Failed to load user records');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setSelectedEmployeeId('');
    setEmail('');
    setPassword('');
    setSelectedRole('hr_payroll_user');
    setAccountStatus(true);
    setModalError(null);
    setShowModal(true);
  };

  const handleEmployeeSelect = (empId: string) => {
    setSelectedEmployeeId(empId);
    if (empId) {
      const emp = employees.find(e => e.id === empId);
      if (emp && emp.email && !email) {
        setEmail(emp.email);
      }
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setModalError('Work email and manual password are required.');
      return;
    }

    setSubmitting(true);
    setModalError(null);

    try {
      await apiRequest<AppUserRecord>('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
          employee_id: selectedEmployeeId ? selectedEmployeeId : null,
          roles: [selectedRole],
          is_active: accountStatus
        })
      });

      setShowModal(false);
      setActionSuccess(`User ${email} created successfully with role ${selectedRole}.`);
      setTimeout(() => setActionSuccess(null), 5000);
      fetchUsersAndEmployees();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      await apiRequest(`/users/${userId}/status`, { method: 'PATCH' });
      fetchUsersAndEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  if (user && !hasRole(['admin'])) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
        <Navbar />
        <main style={{ maxWidth: '800px', margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
          <div className="glass-panel" style={{ padding: '3rem 2rem' }}>
            <AlertCircle size={48} color="var(--red)" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Access Denied</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Only Administrators have access to User Management.
            </p>
            <Link href="/dashboard" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Return to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    hr_payroll_user: 'HR Payroll User',
    hr_manager: 'HR Manager',
    hr_payroll_manager: 'HR Payroll Manager',
    employee: 'Employee',
    admin: 'Administrator'
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
      <Navbar />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              <Shield size={16} /> Administration & Security
            </div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              User Management
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Manage authenticated user accounts, credentials, and RBAC role assignments.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={fetchUsersAndEmployees}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              onClick={handleOpenModal}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
            >
              <Plus size={16} /> Add User
            </button>
          </div>
        </div>

        {/* Feedback alerts */}
        {actionSuccess && (
          <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', color: 'var(--green)', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={18} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {error && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* User Table */}
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
              <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 1rem', color: '#3B82F6' }} />
              <p>Loading user accounts...</p>
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <Users size={48} color="var(--text-dim)" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>No User Accounts Found</h3>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Work Email</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Linked Employee</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Assigned Roles</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Account Status</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Mail size={15} color="var(--primary)" />
                          <span>{u.email}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                        {u.employee_name ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)' }}>
                            <UserCheck size={14} color="var(--green)" />
                            <span>{u.employee_name}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>System / Unlinked</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {u.roles.map(r => (
                            <span
                              key={r}
                              className="badge"
                              style={{
                                background: r === 'admin' ? 'var(--purple-bg)' : r.includes('payroll') ? 'var(--blue-bg)' : 'var(--amber-bg)',
                                color: r === 'admin' ? 'var(--purple)' : r.includes('payroll') ? 'var(--blue)' : 'var(--amber)',
                                border: `1px solid ${r === 'admin' ? 'var(--purple-border)' : r.includes('payroll') ? 'var(--blue-border)' : 'var(--amber-border)'}`,
                                fontSize: '0.72rem',
                                fontWeight: 700
                              }}
                            >
                              {roleLabels[r] || r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <span
                          className="badge"
                          style={{
                            background: u.is_active ? 'var(--green-bg)' : 'var(--red-bg)',
                            color: u.is_active ? 'var(--green)' : 'var(--red)',
                            border: `1px solid ${u.is_active ? 'var(--green-border)' : 'var(--red-border)'}`,
                            fontSize: '0.75rem'
                          }}
                        >
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                        <button
                          onClick={() => handleToggleStatus(u.id)}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                          title={u.is_active ? 'Deactivate User' : 'Activate User'}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add User Modal */}
        {showModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem'
          }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '2rem', background: '#FFFFFF', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Create New User
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.25rem', fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>

              {modalError && (
                <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={16} />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleCreateUser}>
                {/* 1. Linked Employee */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                    Linked Employee (Optional)
                  </label>
                  <select
                    className="form-input"
                    value={selectedEmployeeId}
                    onChange={e => handleEmployeeSelect(e.target.value)}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="">None / System User</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} ({emp.employee_number})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Work Email */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                    Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="user@peoplepay360.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                {/* 3. Password (manually entered by Admin, NOT auto-generated) */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                    Password * <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>(Admin sets password manually)</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter manual user password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                {/* 4. Role Selection (No duplicates!) */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                    Role Assignment *
                  </label>
                  <select
                    className="form-input"
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value)}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="hr_payroll_user">HR Payroll User</option>
                    <option value="hr_manager">HR Manager</option>
                    <option value="hr_payroll_manager">HR Payroll Manager</option>
                    <option value="employee">Employee</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                {/* 5. Account Status */}
                <div style={{ marginBottom: '1.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                    Account Status
                  </label>
                  <select
                    className="form-input"
                    value={accountStatus ? 'active' : 'inactive'}
                    onChange={e => setAccountStatus(e.target.value === 'active')}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary"
                  >
                    {submitting ? 'Creating User...' : 'Create User'}
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
