'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { 
  FileText, ArrowLeft, RefreshCw, CheckCircle, AlertCircle, 
  Layers, Users, Calendar, Clock, DollarSign, ExternalLink, ShieldAlert, Check, Download
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

interface PayslipDetail {
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
  warnings: string[];
  lines: PayslipLine[];
  created_at: string;
  updated_at: string;
}

export default function PayslipDetailPage() {
  const params = useParams();
  const { user, hasRole } = useAuth();

  const payslipId = params.id as string;
  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (payslipId) {
      fetchPayslipDetail();
    }
  }, [payslipId]);

  const fetchPayslipDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<PayslipDetail>(`/payslips/${payslipId}`);
      setPayslip(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load payslip details');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!payslipId) return;
    setDownloadingPdf(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem("pp360_token") : null;
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
      const res = await fetch(`${API_BASE}/payslips/${payslipId}/pdf`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        let errDetail = 'Failed to download PDF';
        try {
          const errJson = await res.json();
          errDetail = errJson.detail || errDetail;
        } catch (_) {}
        throw new Error(errDetail);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${payslip?.employee_number || 'EMP'}_${payslip?.period_start}_to_${payslip?.period_end}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Failed to generate PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const getStatusBadge = (status: PayslipDetail['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="badge" style={{ background: 'var(--yellow-bg)', color: 'var(--yellow)', border: '1px solid var(--yellow-border)', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>
            <Clock size={14} style={{ marginRight: '6px' }} /> Draft
          </span>
        );
      case 'computed':
        return (
          <span className="badge" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue-border)', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>
            <RefreshCw size={14} style={{ marginRight: '6px' }} /> Computed
          </span>
        );
      case 'validated':
        return (
          <span className="badge" style={{ background: 'var(--purple-bg)', color: 'var(--purple)', border: '1px solid var(--purple-border)', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>
            <CheckCircle size={14} style={{ marginRight: '6px' }} /> Validated
          </span>
        );
      case 'paid':
        return (
          <span className="badge" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>
            <DollarSign size={14} style={{ marginRight: '6px' }} /> Paid
          </span>
        );
    }
  };

  if (user && hasRole(['hr_manager']) && !hasRole(['admin', 'hr_payroll_user', 'hr_payroll_manager'])) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
        <Navbar />
        <main style={{ maxWidth: '800px', margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
          <div className="glass-panel" style={{ padding: '3rem 2rem' }}>
            <AlertCircle size={48} color="var(--red)" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Access Denied</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              HR Managers do not have access to payroll features (Payslips).
            </p>
            <Link href="/dashboard" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Return to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
        <Navbar />
        <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--text-muted)' }}>
          <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
          <p>Loading payslip details...</p>
        </div>
      </div>
    );
  }

  if (!payslip) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
        <Navbar />
        <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
          <AlertCircle size={48} color="var(--red)" style={{ margin: '0 auto 1rem' }} />
          <h2>Payslip Not Found</h2>
          <Link href="/payroll/payslips" className="btn btn-secondary" style={{ marginTop: '1rem', textDecoration: 'none', display: 'inline-block' }}>
            Back to Payslips List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
      <Navbar />

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Navigation Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <Link
            href="/payroll/payslips"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.875rem' }}
          >
            <ArrowLeft size={16} /> Back to Payslips List
          </Link>

          {payslip.payrun_id && (
            <Link
              href={`/payroll/payruns/${payslip.payrun_id}`}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
            >
              View Related Payrun <ExternalLink size={12} />
            </Link>
          )}
        </div>

        {/* Payslip Header Card */}
        <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Payslip: {payslip.employee_name}
                </h1>
                {getStatusBadge(payslip.status)}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                ID: {payslip.id}
              </span>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: downloadingPdf ? 'not-allowed' : 'pointer' }}
            >
              {downloadingPdf ? (
                <>
                  <RefreshCw className="animate-spin" size={16} /> Generating PDF...
                </>
              ) : (
                <>
                  <Download size={16} /> Download PDF
                </>
              )}
            </button>
          </div>

          {/* Info Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-glass)' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Employee</span>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {payslip.employee_name} ({payslip.employee_number || 'N/A'})
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{payslip.department_name || 'General'}</span>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Contract</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--primary)', marginTop: '0.2rem' }}>
                {payslip.contract_name || 'Active Contract'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Payroll Period</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {payslip.period_start} to {payslip.period_end}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{payslip.payrun_name || 'Payrun'}</span>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Worked Schedule</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {payslip.worked_days} Days / {payslip.worked_hours} Hours
              </div>
            </div>
          </div>
        </div>

        {/* Warnings Banner if any */}
        {payslip.warnings && payslip.warnings.length > 0 && (
          <div style={{ background: 'var(--yellow-bg)', border: '1px solid var(--yellow-border)', color: 'var(--yellow)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 700 }}>
              <ShieldAlert size={16} /> Calculation Warnings
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
              {payslip.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Salary Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Basic Salary</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.3rem' }}>
              Rs. {payslip.basic_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Total Allowances</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--green)', marginTop: '0.3rem' }}>
              +Rs. {payslip.total_allowances.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Gross Salary</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.3rem' }}>
              Rs. {payslip.gross_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Total Deductions</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--red)', marginTop: '0.3rem' }}>
              -Rs. {payslip.total_deductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem', background: 'var(--green-bg)', border: '1px solid var(--green-border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--green)', textTransform: 'uppercase', fontWeight: 700 }}>Net Payable</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--green)', marginTop: '0.3rem' }}>
              Rs. {payslip.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Salary Rule Breakdown Table */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
            <Layers size={18} color="var(--primary)" /> Executed Salary Rule Breakdown
          </h3>

          {payslip.lines && payslip.lines.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', textAlign: 'left', color: 'var(--text-dim)' }}>
                    <th style={{ padding: '0.75rem 0.5rem', width: '60px' }}>Seq</th>
                    <th style={{ padding: '0.75rem' }}>Rule Code</th>
                    <th style={{ padding: '0.75rem' }}>Rule Name</th>
                    <th style={{ padding: '0.75rem' }}>Category</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payslip.lines.map(line => {
                    const isDeduction = line.category === 'deduction';
                    const isNet = line.category === 'net';
                    const isGross = line.category === 'gross';

                    return (
                      <tr
                        key={line.id}
                        style={{
                          borderBottom: '1px solid var(--border-glass)',
                          background: isNet ? 'rgba(16, 185, 129, 0.06)' : isGross ? 'rgba(37, 99, 235, 0.05)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '0.85rem 0.5rem', fontWeight: 600, color: 'var(--text-dim)' }}>
                          [{line.sequence}]
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          {line.rule_code}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', color: 'var(--text-main)' }}>
                          {line.rule_name}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', textTransform: 'capitalize' }}>
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.75rem',
                              background: isDeduction ? 'var(--red-bg)' : isNet ? 'var(--green-bg)' : 'var(--blue-bg)',
                              color: isDeduction ? 'var(--red)' : isNet ? 'var(--green)' : 'var(--blue)',
                              border: `1px solid ${isDeduction ? 'var(--red-border)' : isNet ? 'var(--green-border)' : 'var(--blue-border)'}`
                            }}
                          >
                            {line.category}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '0.85rem 0.75rem',
                            textAlign: 'right',
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            color: isDeduction ? 'var(--red)' : isNet ? 'var(--green)' : 'var(--text-main)'
                          }}
                        >
                          {isDeduction && line.amount < 0 ? '-' : ''}Rs. {Math.abs(line.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
              No rule lines found for this payslip. Compute the payrun to generate detailed rule lines.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
