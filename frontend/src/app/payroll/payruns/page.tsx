'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { 
  DollarSign, Plus, ArrowRight, CheckCircle, Clock, 
  AlertCircle, RefreshCw, Trash2, Calendar, Users, Eye, Layers, Filter
} from 'lucide-react';

interface Payrun {
  id: string;
  name: string;
  salary_structure_id: string;
  salary_structure_name?: string;
  period_start: string;
  period_end: string;
  status: 'draft' | 'computed' | 'validated' | 'paid';
  employee_type_filter?: string;
  department_id?: string;
  department_name?: string;
  total_net: number;
  total_gross: number;
  payslip_count: number;
  created_at: string;
  updated_at: string;
}

export default function PayrunsListPage() {
  const { user, hasRole } = useAuth();
  const [payruns, setPayruns] = useState<Payrun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPayruns();
  }, []);

  const fetchPayruns = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<Payrun[]>('/payruns');
      setPayruns(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load payruns');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDraft = async (payrunId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this draft payrun?')) return;

    setDeletingId(payrunId);
    try {
      await apiRequest(`/payruns/${payrunId}`, { method: 'DELETE' });
      setPayruns(prev => prev.filter(p => p.id !== payrunId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete payrun');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredPayruns = payruns.filter(p => {
    if (statusFilter === 'all') return true;
    return p.status === statusFilter;
  });

  const getStatusBadge = (status: Payrun['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="badge" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid var(--amber-border)' }}>
            <Clock size={12} style={{ marginRight: '4px' }} /> Draft
          </span>
        );
      case 'computed':
        return (
          <span className="badge" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue-border)' }}>
            <RefreshCw size={12} style={{ marginRight: '4px' }} /> Computed
          </span>
        );
      case 'validated':
        return (
          <span className="badge" style={{ background: 'var(--purple-bg)', color: 'var(--purple)', border: '1px solid var(--purple-border)' }}>
            <CheckCircle size={12} style={{ marginRight: '4px' }} /> Validated
          </span>
        );
      case 'paid':
        return (
          <span className="badge" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' }}>
            <DollarSign size={12} style={{ marginRight: '4px' }} /> Paid
          </span>
        );
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
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
      <Navbar />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              <DollarSign size={16} /> Payroll Management
            </div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Payroll Runs
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Create, compute, validate, and process employee payruns.
            </p>
          </div>

          {hasRole(['admin', 'hr_payroll_user', 'hr_payroll_manager']) && (
            <Link
              href="/payroll/payruns/create"
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
            >
              <Plus size={18} /> New Payrun
            </Link>
          )}
        </div>

        {/* Filter Bar */}
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status Filter:</span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {['all', 'draft', 'computed', 'validated', 'paid'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    border: statusFilter === st ? '1px solid #3B82F6' : '1px solid var(--border-glass)',
                    background: statusFilter === st ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    color: statusFilter === st ? '#FFF' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={fetchPayruns}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
            <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 1rem', color: '#3B82F6' }} />
            <p>Loading payruns...</p>
          </div>
        ) : filteredPayruns.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <DollarSign size={48} color="var(--text-dim)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Payruns Found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
              {statusFilter === 'all' ? 'Get started by creating your first two-step payroll run.' : `No payruns currently match the filter '${statusFilter}'.`}
            </p>
            {hasRole(['admin', 'hr_payroll_user', 'hr_payroll_manager']) && (
              <Link href="/payroll/payruns/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                <Plus size={16} style={{ marginRight: '0.4rem' }} /> Create Payrun
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
            {filteredPayruns.map(payrun => (
              <div
                key={payrun.id}
                className="glass-panel"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  transition: 'transform 0.2s, border-color 0.2s',
                  position: 'relative'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                      {payrun.name}
                    </h3>
                    {getStatusBadge(payrun.status)}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={14} color="var(--primary)" />
                      <span>{payrun.period_start} to {payrun.period_end}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Layers size={14} color="var(--purple)" />
                      <span>{payrun.salary_structure_name || 'Salary Structure'}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Users size={14} color="var(--green)" />
                      <span>{payrun.payslip_count} Selected Employees</span>
                    </div>
                  </div>
                </div>

                {/* Amounts Breakdown */}
                <div style={{ background: '#F8FAFC', border: '1px solid var(--border)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Gross Salary</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Rs. {(payrun.total_gross || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Net Payable</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--green)' }}>
                      Rs. {(payrun.total_net || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--border-glass)' }}>
                  {payrun.status === 'draft' && hasRole(['admin', 'hr_payroll_manager']) && (
                    <button
                      onClick={(e) => handleDeleteDraft(payrun.id, e)}
                      disabled={deletingId === payrun.id}
                      style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                  {payrun.status !== 'draft' && <span />}

                  <Link
                    href={`/payroll/payruns/${payrun.id}`}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
                  >
                    <Eye size={14} /> View Details <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
