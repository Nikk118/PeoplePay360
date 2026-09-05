'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { 
  FileText, Search, Filter, RefreshCw, Eye, Calendar, 
  DollarSign, CheckCircle, Clock, AlertCircle, Users, ArrowRight
} from 'lucide-react';

interface Payslip {
  id: string;
  payrun_id: string;
  payrun_name?: string;
  salary_structure_name?: string;
  employee_id: string;
  employee_number?: string;
  employee_name?: string;
  department_name?: string;
  contract_id: string;
  contract_name?: string;
  period_start: string;
  period_end: string;
  worked_days: number;
  worked_hours: number;
  basic_salary: number;
  total_allowances: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  status: 'draft' | 'computed' | 'validated' | 'paid';
  created_at: string;
}

export default function PayslipsListPage() {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPayslips();
  }, []);

  const fetchPayslips = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<Payslip[]>('/payslips');
      setPayslips(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load payslips');
    } finally {
      setLoading(false);
    }
  };

  const filteredPayslips = payslips.filter(ps => {
    if (statusFilter !== 'all' && ps.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const empName = (ps.employee_name || '').toLowerCase();
      const empNum = (ps.employee_number || '').toLowerCase();
      const payrun = (ps.payrun_name || '').toLowerCase();
      const dept = (ps.department_name || '').toLowerCase();
      if (!empName.includes(q) && !empNum.includes(q) && !payrun.includes(q) && !dept.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const getStatusBadge = (status: Payslip['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="badge" style={{ background: 'var(--yellow-bg)', color: 'var(--yellow)', border: '1px solid var(--yellow-border)' }}>
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
      <Navbar />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              <FileText size={16} /> Employee Payslips
            </div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Payslip Records
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              View and inspect official calculated payroll payslips for employees.
            </p>
          </div>

          <button
            onClick={fetchPayslips}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Filter Bar */}
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', flex: 1 }}>
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
              <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search employee, code, or payrun..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.3rem', fontSize: '0.85rem' }}
              />
            </div>

            {/* Status Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Filter size={16} color="var(--text-muted)" style={{ marginRight: '0.25rem' }} />
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
                    border: statusFilter === st ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                    background: statusFilter === st ? 'var(--primary)' : 'transparent',
                    color: statusFilter === st ? '#FFF' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {st}
                </button>
              ))}
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

        {/* Loading State */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
            <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
            <p>Loading payslips...</p>
          </div>
        ) : filteredPayslips.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <FileText size={48} color="var(--text-dim)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Payslips Found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '400px', margin: '0 auto' }}>
              {searchQuery || statusFilter !== 'all' ? 'No payslips match your search or filter criteria.' : 'No payslip records exist yet. Payslips are generated when a Payrun is computed.'}
            </p>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '1.25rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', textAlign: 'left', color: 'var(--text-dim)' }}>
                  <th style={{ padding: '0.75rem' }}>Code</th>
                  <th style={{ padding: '0.75rem' }}>Employee Name</th>
                  <th style={{ padding: '0.75rem' }}>Payrun & Period</th>
                  <th style={{ padding: '0.75rem' }}>Basic</th>
                  <th style={{ padding: '0.75rem' }}>Allowances</th>
                  <th style={{ padding: '0.75rem' }}>Deductions</th>
                  <th style={{ padding: '0.75rem' }}>Gross</th>
                  <th style={{ padding: '0.75rem' }}>Net Payable</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayslips.map(ps => (
                  <tr key={ps.id} style={{ borderBottom: '1px solid var(--border-glass)', transition: 'background 0.15s' }}>
                    <td style={{ padding: '0.85rem 0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {ps.employee_number || 'EMP'}
                    </td>
                    <td style={{ padding: '0.85rem 0.75rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{ps.employee_name || 'Employee'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{ps.department_name || 'General'}</div>
                    </td>
                    <td style={{ padding: '0.85rem 0.75rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.8rem' }}>{ps.payrun_name || 'Payrun'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ps.period_start} to {ps.period_end}</div>
                    </td>
                    <td style={{ padding: '0.85rem 0.75rem', color: 'var(--text-main)', fontWeight: 600 }}>
                      Rs. {(ps.basic_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem 0.75rem', color: 'var(--green)', fontWeight: 600 }}>
                      +Rs. {(ps.total_allowances || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem 0.75rem', color: 'var(--red)', fontWeight: 600 }}>
                      -Rs. {(ps.total_deductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem 0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Rs. {(ps.gross_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem 0.75rem', fontWeight: 800, color: 'var(--green)', fontSize: '0.95rem' }}>
                      Rs. {(ps.net_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem 0.75rem' }}>
                      {getStatusBadge(ps.status)}
                    </td>
                    <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                      <Link
                        href={`/payroll/payslips/${ps.id}`}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
                      >
                        <Eye size={14} /> View <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
