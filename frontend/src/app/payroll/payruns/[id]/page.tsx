'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { 
  DollarSign, ArrowLeft, RefreshCw, CheckCircle, AlertCircle, 
  Layers, Users, Calendar, Trash2, ChevronDown, ChevronUp, Clock, ShieldCheck, List
} from 'lucide-react';

interface PayslipLine {
  id: string;
  salary_rule_id: string;
  rule_name: string;
  rule_code: string;
  category: string;
  sequence: number;
  amount: number;
}

interface Payslip {
  id: string;
  payrun_id: string;
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
  status: string;
  warnings: string[];
  lines: PayslipLine[];
}

interface PayrunDetail {
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
  payslips: Payslip[];
  created_at: string;
  updated_at: string;
}

export default function PayrunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, hasRole } = useAuth();

  const payrunId = params.id as string;
  const [payrun, setPayrun] = useState<PayrunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    if (payrunId) {
      fetchPayrunDetail();
    }
  }, [payrunId]);

  const fetchPayrunDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<PayrunDetail>(`/payruns/${payrunId}`);
      setPayrun(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load payrun details');
    } finally {
      setLoading(false);
    }
  };

  const handleCompute = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const updated = await apiRequest<PayrunDetail>(`/payruns/${payrunId}/compute`, { method: 'POST' });
      setPayrun(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to compute payrun');
    } finally {
      setActionLoading(false);
    }
  };

  const handleValidate = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const updated = await apiRequest<PayrunDetail>(`/payruns/${payrunId}/validate`, { method: 'POST' });
      setPayrun(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to validate payrun');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const updated = await apiRequest<PayrunDetail>(`/payruns/${payrunId}/mark-paid`, { method: 'POST' });
      setPayrun(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to mark payrun as paid');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this draft payrun?')) return;
    setActionLoading(true);
    try {
      await apiRequest(`/payruns/${payrunId}`, { method: 'DELETE' });
      router.push('/payroll/payruns');
    } catch (err: any) {
      setError(err.message || 'Failed to delete payrun');
      setActionLoading(false);
    }
  };

  const toggleExpand = (empId: string) => {
    setExpandedEmployeeId(prev => (prev === empId ? null : empId));
  };

  const getStatusBadge = (status: PayrunDetail['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="badge" style={{ background: 'var(--yellow-bg)', color: 'var(--yellow)', border: '1px solid var(--yellow-border)', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
            <Clock size={14} style={{ marginRight: '6px' }} /> Draft
          </span>
        );
      case 'computed':
        return (
          <span className="badge" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue-border)', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
            <RefreshCw size={14} style={{ marginRight: '6px' }} /> Computed
          </span>
        );
      case 'validated':
        return (
          <span className="badge" style={{ background: 'var(--purple-bg)', color: 'var(--purple)', border: '1px solid var(--purple-border)', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
            <CheckCircle size={14} style={{ marginRight: '6px' }} /> Validated
          </span>
        );
      case 'paid':
        return (
          <span className="badge" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
            <DollarSign size={14} style={{ marginRight: '6px' }} /> Payment Completed
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
        <Navbar />
        <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--text-muted)' }}>
          <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
          <p>Loading payrun details...</p>
        </div>
      </div>
    );
  }

  if (!payrun) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
        <Navbar />
        <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
          <AlertCircle size={48} color="var(--red)" style={{ margin: '0 auto 1rem' }} />
          <h2>Payrun Not Found</h2>
          <Link href="/payroll/payruns" className="btn btn-secondary" style={{ marginTop: '1rem', textDecoration: 'none', display: 'inline-block' }}>
            Back to Payruns List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
      <Navbar />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Navigation Back */}
        <Link
          href="/payroll/payruns"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1.5rem' }}
        >
          <ArrowLeft size={16} /> Back to Payruns List
        </Link>

        {/* Header Summary Card */}
        <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  {payrun.name}
                </h1>
                {getStatusBadge(payrun.status)}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={15} color="var(--primary)" />
                  <span>Period: <strong>{payrun.period_start}</strong> to <strong>{payrun.period_end}</strong></span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Layers size={15} color="var(--purple)" />
                  <span>Structure: <strong>{payrun.salary_structure_name || 'Salary Structure'}</strong></span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Users size={15} color="var(--green)" />
                  <span>Employees: <strong>{payrun.payslip_count} selected</strong></span>
                </div>
              </div>
            </div>

            {/* Workflow Action Buttons */}
            {hasRole(['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager']) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {payrun.status === 'draft' && (
                  <>
                    <button
                      onClick={handleDelete}
                      disabled={actionLoading}
                      className="btn btn-secondary"
                      style={{ color: 'var(--red)', border: '1px solid var(--red-border)' }}
                    >
                      <Trash2 size={16} /> Delete
                    </button>

                    <button
                      onClick={handleCompute}
                      disabled={actionLoading}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      {actionLoading ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                      Compute Payroll
                    </button>
                  </>
                )}

                {payrun.status === 'computed' && (
                  <>
                    <button
                      onClick={handleCompute}
                      disabled={actionLoading}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <RefreshCw size={14} /> Re-Compute
                    </button>

                    <button
                      onClick={handleValidate}
                      disabled={actionLoading}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }}
                    >
                      {actionLoading ? <RefreshCw className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                      Validate Payrun
                    </button>
                  </>
                )}

                {payrun.status === 'validated' && (
                  <button
                    onClick={handleMarkPaid}
                    disabled={actionLoading}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                  >
                    {actionLoading ? <RefreshCw className="animate-spin" size={16} /> : <DollarSign size={16} />}
                    Mark as Paid
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Financial Totals Widget */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-glass)' }}>
            <div style={{ background: 'var(--bg-page)', border: '1px solid var(--border-glass)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Total Gross Salary</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                Rs. {(payrun.total_gross || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ background: 'var(--bg-page)', border: '1px solid var(--border-glass)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Total Net Payable</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--green)', marginTop: '0.2rem' }}>
                Rs. {(payrun.total_net || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
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

        {/* Selected Employees & Payslips Table */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              <List size={18} color="var(--primary)" /> Calculated Employee Payslips ({payrun.payslips.length})
            </h3>
            {payrun.status === 'draft' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--yellow)', fontWeight: 600 }}>
                ⚠️ Draft status: Click "Compute Payroll" above to execute salary rules.
              </span>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', textAlign: 'left', color: 'var(--text-dim)' }}>
                  <th style={{ padding: '0.75rem' }}>Code</th>
                  <th style={{ padding: '0.75rem' }}>Employee</th>
                  <th style={{ padding: '0.75rem' }}>Worked</th>
                  <th style={{ padding: '0.75rem' }}>Basic</th>
                  <th style={{ padding: '0.75rem' }}>Allowances</th>
                  <th style={{ padding: '0.75rem' }}>Deductions</th>
                  <th style={{ padding: '0.75rem' }}>Gross</th>
                  <th style={{ padding: '0.75rem' }}>Net Salary</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {payrun.payslips.map(ps => {
                  const isExpanded = expandedEmployeeId === ps.employee_id;
                  return (
                    <React.Fragment key={ps.id}>
                      <tr style={{ borderBottom: '1px solid var(--border-glass)', background: isExpanded ? 'rgba(37, 99, 235, 0.06)' : 'transparent' }}>
                        <td style={{ padding: '0.85rem 0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {ps.employee_number || 'EMP'}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{ps.employee_name || 'Employee'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{ps.department_name || 'General'}</div>
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', color: 'var(--text-muted)' }}>
                          {ps.worked_days}d / {ps.worked_hours}h
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', color: 'var(--text-main)', fontWeight: 600 }}>
                          Rs. {ps.basic_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', color: 'var(--green)', fontWeight: 600 }}>
                          +Rs. {ps.total_allowances.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', color: 'var(--red)', fontWeight: 600 }}>
                          -Rs. {ps.total_deductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          Rs. {ps.gross_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', fontWeight: 800, color: 'var(--green)', fontSize: '0.95rem' }}>
                          Rs. {ps.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                          <button
                            onClick={() => toggleExpand(ps.employee_id)}
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Rules
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Payslip Rule Lines */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} style={{ padding: '1rem', background: 'var(--bg-page)', borderBottom: '1px solid var(--border-glass)' }}>
                            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                              <h5 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Layers size={14} /> Calculated Rule Breakdown for {ps.employee_name}
                              </h5>

                              {ps.warnings && ps.warnings.length > 0 && (
                                <div style={{ background: 'var(--yellow-bg)', border: '1px solid var(--yellow-border)', color: 'var(--yellow)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                                  ⚠️ {ps.warnings.join(', ')}
                                </div>
                              )}

                              {ps.lines && ps.lines.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.5rem' }}>
                                  {ps.lines.map(line => (
                                    <div
                                      key={line.id}
                                      style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-glass)',
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: 'var(--radius-md)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                      }}
                                    >
                                      <div>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block' }}>
                                          [{line.sequence}] {line.rule_code}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                                          {line.rule_name} ({line.category})
                                        </span>
                                      </div>
                                      <span style={{
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        color: line.category === 'deduction' ? 'var(--red)' : line.category === 'net' ? 'var(--green)' : 'var(--text-main)'
                                      }}>
                                        Rs. {line.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                                  No calculated rules yet. Compute the payrun to generate detailed rule lines.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
