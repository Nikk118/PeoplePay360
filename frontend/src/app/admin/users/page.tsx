'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import {
  Users, Shield, Plus, RefreshCw, CheckCircle,
  AlertCircle, Mail, UserCheck, Send, Trash2, Link2
} from 'lucide-react';

interface AppUserRecord {
  id: string;
  email: string;
  employee_id?: string;
  employee_name?: string;
  is_active: boolean;
  roles: string[];
  invitation_pending?: boolean;
  invitation_link?: string;
  email_sent?: boolean;
  email_error?: string;
}

interface EmployeeOption {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email?: string;
}

interface DepartmentOption {
  id: string;
  name: string;
}

export default function AdminUsersPage() {
  const { user, hasRole } = useAuth();
  const [users, setUsers] = useState<AppUserRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form Fields
  const [selectedRole, setSelectedRole] = useState('employee');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Link Employee Modal State
  const [linkingUser, setLinkingUser] = useState<AppUserRecord | null>(null);
  const [linkModalEmployeeId, setLinkModalEmployeeId] = useState('');
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [linkModalError, setLinkModalError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsersAndEmployees();
  }, []);

  const fetchUsersAndEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, empData, deptData] = await Promise.all([
        apiRequest<AppUserRecord[]>('/users'),
        apiRequest<EmployeeOption[]>('/employees').catch(() => []),
        apiRequest<DepartmentOption[]>('/departments').catch(() => [])
      ]);
      setUsers(usersData);
      setEmployees(empData);
      setDepartments(deptData);
    } catch (err: any) {
      setError(err.message || 'Failed to load user records');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setSelectedRole('employee');
    setSelectedEmployeeId('');
    setEmail('');
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
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setModalError('Work email is required.');
      return;
    }

    if (selectedRole === 'employee' && !selectedEmployeeId) {
      setModalError('Please select an existing employee to link to this account.');
      return;
    }

    setSubmitting(true);
    setModalError(null);
    setActionError(null);
    setActionSuccess(null);

    try {
      const payload: any = {
        email: cleanEmail,
        roles: [selectedRole]
      };

      if (selectedEmployeeId) {
        payload.employee_id = selectedEmployeeId;
      }

      const res = await apiRequest<AppUserRecord>('/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowModal(false);
      if (res.email_sent === false) {
        setActionError(`User account created in pending state, but invitation email could not be sent: ${res.email_error}`);
        setTimeout(() => setActionError(null), 10000);
      } else {
        setActionSuccess(`Invitation email successfully sent to ${cleanEmail} via Resend.`);
        setTimeout(() => setActionSuccess(null), 6000);
      }
      fetchUsersAndEmployees();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create and invite user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendInvitation = async (userId: string, userEmail: string) => {
    setResendingId(userId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/users/${userId}/resend-invitation`, { method: 'POST' });
      setActionSuccess(res.message || `Invitation successfully sent to ${userEmail} via Resend.`);
      setTimeout(() => setActionSuccess(null), 5000);
      fetchUsersAndEmployees();
    } catch (err: any) {
      setActionError(err.message || 'Failed to resend invitation email via Resend');
      setTimeout(() => setActionError(null), 8000);
    } finally {
      setResendingId(null);
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

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!window.confirm(`Are you sure you want to delete this user (${userEmail})?`)) {
      return;
    }

    setDeletingId(userId);
    setActionError(null);
    setActionSuccess(null);

    try {
      await apiRequest(`/users/${userId}`, { method: 'DELETE' });
      setActionSuccess(`User ${userEmail} was successfully deleted.`);
      setTimeout(() => setActionSuccess(null), 5000);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete user');
      setTimeout(() => setActionError(null), 8000);
    } finally {
      setDeletingId(null);
    }
  };

  const handleLinkEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingUser || !linkModalEmployeeId) return;

    setLinkingLoading(true);
    setLinkModalError(null);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await apiRequest<AppUserRecord>(`/users/${linkingUser.id}/link-employee`, {
        method: 'PATCH',
        body: JSON.stringify({ employee_id: linkModalEmployeeId })
      });
      setActionSuccess(`User ${linkingUser.email} was successfully linked to ${res.employee_name}.`);
      setTimeout(() => setActionSuccess(null), 5000);
      setLinkingUser(null);
      fetchUsersAndEmployees();
    } catch (err: any) {
      setLinkModalError(err.message || 'Failed to link employee to user account');
    } finally {
      setLinkingLoading(false);
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

        {actionError && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} />
            <span>{actionError}</span>
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
                            <span style={{ fontWeight: 600 }}>{u.employee_name}</span>
                          </div>
                        ) : u.roles.includes('employee') ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: '0.75rem' }}>⚠️ Missing Link</span>
                            <button
                              onClick={() => {
                                setLinkingUser(u);
                                setLinkModalEmployeeId('');
                                setLinkModalError(null);
                              }}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              title="Link an Employee from directory"
                            >
                              <Link2 size={11} />
                              Link Employee
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>System User</span>
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
                        {u.invitation_pending ? (
                          <span
                            className="badge"
                            style={{
                              background: 'var(--amber-bg)',
                              color: 'var(--amber)',
                              border: '1px solid var(--amber-border)',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}
                          >
                            Pending Invite
                          </span>
                        ) : (
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
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                          {u.invitation_pending && (
                            <button
                              onClick={() => handleResendInvitation(u.id, u.email)}
                              disabled={resendingId === u.id}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                              title="Resend Invitation Email"
                            >
                              <Send size={12} className={resendingId === u.id ? 'animate-spin' : ''} />
                              {resendingId === u.id ? 'Sending...' : 'Resend Invite'}
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleStatus(u.id)}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                            title={u.is_active ? 'Deactivate User' : 'Activate User'}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            disabled={deletingId === u.id || (user ? user.id === u.id : false)}
                            className="btn btn-secondary"
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.3rem 0.65rem',
                              color: 'var(--red)',
                              borderColor: 'rgba(239, 68, 68, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                            title={user && user.id === u.id ? 'Cannot delete your own active account' : 'Delete User'}
                          >
                            <Trash2 size={12} className={deletingId === u.id ? 'animate-spin' : ''} />
                            {deletingId === u.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
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
                  Invite New User
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.25rem', fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>

              <div style={{
                background: 'var(--blue-bg)',
                border: '1px solid var(--blue-border)',
                color: 'var(--blue)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                fontSize: '0.825rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Mail size={16} style={{ flexShrink: 0 }} />
                <span>An invitation email with a secure link will be sent to the employee via Resend to set their own password.</span>
              </div>

              {modalError && (
                <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={16} />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleCreateUser}>
                {/* 1. Role Selection */}
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
                    <option value="employee">Employee</option>
                    <option value="hr_payroll_user">HR Payroll User</option>
                    <option value="hr_manager">HR Manager</option>
                    <option value="hr_payroll_manager">HR Payroll Manager</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                {/* 2. Employee Binding */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      Linked Employee {selectedRole === 'employee' ? '*' : '(Optional)'}
                    </label>
                    {selectedRole === 'employee' && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--blue)', fontWeight: 600 }}>Required for Employee Role</span>
                    )}
                  </div>

                  <select
                    className="form-input"
                    value={selectedEmployeeId}
                    onChange={e => handleEmployeeSelect(e.target.value)}
                    required={selectedRole === 'employee'}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="">
                      {selectedRole === 'employee'
                        ? '-- Choose Existing Employee from Directory (Required) --'
                        : 'None / System User (Optional)'}
                    </option>
                    {employees.map(emp => {
                      const isLinked = users.some(u => u.employee_id === emp.id);
                      return (
                        <option key={emp.id} value={emp.id} disabled={isLinked}>
                          {emp.first_name} {emp.last_name} ({emp.employee_number || emp.id}){isLinked ? ' — [Already Linked]' : ''}
                        </option>
                      );
                    })}
                  </select>

                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    {selectedRole === 'employee' ? (
                      <>
                        Employee accounts must be linked to an existing personnel record in the Employee Directory.{' '}
                        <Link href="/employees" target="_blank" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'underline' }}>
                          Add new employee in Directory ↗
                        </Link>
                      </>
                    ) : (
                      'System and administrative users can be unlinked, or associated with an existing employee profile.'
                    )}
                  </p>
                </div>

                {/* 3. Work Email */}
                <div style={{ marginBottom: '1.75rem' }}>
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
                    {submitting ? 'Sending Invitation...' : 'Create & Send Invitation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Link Employee to User Modal */}
        {linkingUser && (
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
            <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2rem', background: '#FFFFFF', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Link Employee Profile
                </h3>
                <button
                  onClick={() => setLinkingUser(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.25rem', fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Select an active employee from the Employee Directory to link to user account <strong>{linkingUser.email}</strong>.
              </p>

              {linkModalError && (
                <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={16} />
                  <span>{linkModalError}</span>
                </div>
              )}

              <form onSubmit={handleLinkEmployee}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                    Select Employee *
                  </label>
                  <select
                    className="form-input"
                    value={linkModalEmployeeId}
                    onChange={e => setLinkModalEmployeeId(e.target.value)}
                    required
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map(emp => {
                      const isLinked = users.some(u => u.employee_id === emp.id && u.id !== linkingUser.id);
                      return (
                        <option key={emp.id} value={emp.id} disabled={isLinked}>
                          {emp.first_name} {emp.last_name} ({emp.employee_number}){isLinked ? ' — [Already Linked]' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setLinkingUser(null)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={linkingLoading || !linkModalEmployeeId}
                    className="btn btn-primary"
                  >
                    {linkingLoading ? 'Linking...' : 'Confirm Link'}
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
