'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { 
  BarChart2, DollarSign, Users, FileText, Clock, Calendar, 
  AlertCircle, ShieldAlert, RefreshCw, Filter, ArrowUpRight, 
  CheckCircle, Layers, Check, TrendingUp, UserX, AlertTriangle, Info, ChevronRight
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

interface Payrun {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
}

interface DashboardData {
  summary: {
    total_gross_salary: number;
    total_deductions: number;
    total_net_salary: number;
    total_basic_salary: number;
    total_allowances: number;
    payslip_count: number;
    employee_count: number;
    total_employees: number;
    selected_period?: {
      start_date?: string;
      end_date?: string;
      payrun_name?: string;
    };
  };
  payslip_status: {
    draft: number;
    computed: number;
    validated: number;
    paid: number;
    total: number;
  };
  salary_by_department: Array<{
    department_id?: string;
    department_name: string;
    total_gross: number;
    total_net: number;
    employee_count: number;
  }>;
  payroll_trends: Array<{
    payrun_id?: string;
    payrun_name: string;
    period_start: string;
    period_end: string;
    total_gross: number;
    total_net: number;
    total_deductions: number;
    payslip_count: number;
    status: string;
  }>;
  attendance: {
    total_records: number;
    present_records: number;
    absent_records: number;
    half_day_records: number;
    late_records: number;
    total_worked_hours: number;
  };
  time_off: {
    pending_requests: number;
    approved_requests: number;
    refused_requests: number;
    total_allocated_days: number;
    used_days: number;
    remaining_days: number;
    by_type: Array<{
      type_name: string;
      code: string;
      allocated: number;
      taken: number;
    }>;
  };
  warnings: Array<{
    category: string;
    message: string;
    employee_id?: string;
    employee_name?: string;
    severity: 'error' | 'warning' | 'info';
  }>;
}

export default function DashboardPage() {
  const { user } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [departments, setDepartments] = useState<Department[]>([]);
  const [payruns, setPayruns] = useState<Payrun[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPayrun, setSelectedPayrun] = useState<string>('all');

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedDept, selectedStatus, selectedPayrun]);

  const fetchMetadata = async () => {
    try {
      const [deptRes, payrunRes] = await Promise.all([
        apiRequest<Department[]>('/departments').catch(() => []),
        apiRequest<Payrun[]>('/payruns').catch(() => [])
      ]);
      setDepartments(deptRes);
      setPayruns(payrunRes);
    } catch (_) {}
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      let queryParams = [];
      if (selectedDept !== 'all') queryParams.push(`department_id=${selectedDept}`);
      if (selectedStatus !== 'all') queryParams.push(`status=${selectedStatus}`);
      if (selectedPayrun !== 'all') queryParams.push(`payrun_id=${selectedPayrun}`);

      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const result = await apiRequest<DashboardData>(`/dashboard/overview${queryString}`);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return 'Rs. ' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', color: 'var(--text-main)' }}>
      <Navbar />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60A5FA', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              <BarChart2 size={16} /> Executive Payroll Analytics
            </div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: '#FFF' }}>
              Dashboard & Reports
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Live real-time organization metrics for payroll, attendance, leave, and compliance audits.
            </p>
          </div>

          <button
            onClick={fetchDashboardData}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Data
          </button>
        </div>

        {/* Filter Bar */}
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-dim)', fontSize: '0.85rem', fontWeight: 600 }}>
            <Filter size={16} /> Filters:
          </div>

          {/* Department Filter */}
          <div style={{ minWidth: '180px' }}>
            <select
              className="form-input"
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Payrun/Period Filter */}
          <div style={{ minWidth: '200px' }}>
            <select
              className="form-input"
              value={selectedPayrun}
              onChange={e => setSelectedPayrun(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
            >
              <option value="all">All Payroll Cycles</option>
              {payruns.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.period_start})</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ minWidth: '160px' }}>
            <select
              className="form-input"
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="computed">Computed</option>
              <option value="validated">Validated</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {(selectedDept !== 'all' || selectedStatus !== 'all' || selectedPayrun !== 'all') && (
            <button
              onClick={() => {
                setSelectedDept('all');
                setSelectedStatus('all');
                setSelectedPayrun('all');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#60A5FA',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: 600,
                textDecoration: 'underline'
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && !data ? (
          <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--text-muted)' }}>
            <RefreshCw className="animate-spin" size={36} style={{ margin: '0 auto 1rem', color: '#3B82F6' }} />
            <p style={{ fontSize: '0.95rem' }}>Gathering organization analytics...</p>
          </div>
        ) : data ? (
          <>
            {/* KPI Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
              {/* Gross Salary */}
              <div className="glass-panel" style={{ padding: '1.35rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Total Gross Payroll</span>
                  <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DollarSign size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFF', marginTop: '0.5rem' }}>
                  {formatCurrency(data.summary.total_gross_salary)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Includes basic & allowances
                </div>
              </div>

              {/* Deductions */}
              <div className="glass-panel" style={{ padding: '1.35rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Total Deductions</span>
                  <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F87171', marginTop: '0.5rem' }}>
                  - {formatCurrency(data.summary.total_deductions)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Tax, PF & Unpaid Leave
                </div>
              </div>

              {/* Net Payable */}
              <div className="glass-panel" style={{ padding: '1.35rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6EE7B7', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Total Net Payable</span>
                  <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'rgba(16, 185, 129, 0.2)', color: '#4ADE80', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4ADE80', marginTop: '0.5rem' }}>
                  {formatCurrency(data.summary.total_net_salary)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#A7F3D0', marginTop: '0.35rem' }}>
                  Final net amount to disburse
                </div>
              </div>

              {/* Headcount / Payslips */}
              <div className="glass-panel" style={{ padding: '1.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Payroll Headcount</span>
                  <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'rgba(168, 85, 247, 0.15)', color: '#C084FC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFF', marginTop: '0.5rem' }}>
                  {data.summary.employee_count} / {data.summary.total_employees} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>Employees</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  {data.summary.payslip_count} total generated payslips
                </div>
              </div>
            </div>

            {/* Row 2: Payslip Status Breakdown & Department Salary Chart */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
              
              {/* Payslip Status Breakdown */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={18} color="#60A5FA" /> Payslip Processing Status
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Total: {data.payslip_status.total}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  {/* Draft */}
                  <div style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#FACC15', fontWeight: 600, display: 'block' }}>Draft</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFF', marginTop: '0.2rem' }}>
                      {data.payslip_status.draft}
                    </div>
                  </div>

                  {/* Computed */}
                  <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#60A5FA', fontWeight: 600, display: 'block' }}>Computed</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFF', marginTop: '0.2rem' }}>
                      {data.payslip_status.computed}
                    </div>
                  </div>

                  {/* Validated */}
                  <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#C084FC', fontWeight: 600, display: 'block' }}>Validated</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFF', marginTop: '0.2rem' }}>
                      {data.payslip_status.validated}
                    </div>
                  </div>

                  {/* Paid */}
                  <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#4ADE80', fontWeight: 600, display: 'block' }}>Paid</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFF', marginTop: '0.2rem' }}>
                      {data.payslip_status.paid}
                    </div>
                  </div>
                </div>

                {/* Progress Visual Bar */}
                {data.payslip_status.total > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Workflow Progress</span>
                      <span>{Math.round(((data.payslip_status.paid + data.payslip_status.validated) / data.payslip_status.total) * 100)}% Complete</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${(data.payslip_status.paid / data.payslip_status.total) * 100}%`, background: '#4ADE80' }} title="Paid" />
                      <div style={{ width: `${(data.payslip_status.validated / data.payslip_status.total) * 100}%`, background: '#C084FC' }} title="Validated" />
                      <div style={{ width: `${(data.payslip_status.computed / data.payslip_status.total) * 100}%`, background: '#60A5FA' }} title="Computed" />
                      <div style={{ width: `${(data.payslip_status.draft / data.payslip_status.total) * 100}%`, background: '#FACC15' }} title="Draft" />
                    </div>
                  </div>
                )}
              </div>

              {/* Salary by Department Chart */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={18} color="#C084FC" /> Salary Distribution by Department
                </h3>

                {data.salary_by_department.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0, textAlign: 'center', padding: '2rem 0' }}>
                    No department payroll data available for current selection.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {data.salary_by_department.map((dept, i) => {
                      const maxGross = Math.max(...data.salary_by_department.map(d => d.total_gross), 1);
                      const pct = Math.min(100, Math.max(5, (dept.total_gross / maxGross) * 100));
                      const barColors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899'];
                      const color = barColors[i % barColors.length];

                      return (
                        <div key={dept.department_id || i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                            <span style={{ fontWeight: 600, color: '#FFF' }}>{dept.department_name} ({dept.employee_count} emp)</span>
                            <span style={{ fontWeight: 700, color: color }}>{formatCurrency(dept.total_gross)}</span>
                          </div>
                          <div style={{ width: '100%', height: '10px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '5px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: color,
                                borderRadius: '5px',
                                transition: 'width 0.5s ease'
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Row 3: Payroll Trends & Attendance / Leave */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
              
              {/* Payroll Trends */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp size={18} color="#34D399" /> Payroll Period Trends
                </h3>

                {data.payroll_trends.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0, textAlign: 'center', padding: '2rem 0' }}>
                    No historical payrun cycles recorded yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {data.payroll_trends.map(t => (
                      <div
                        key={t.payrun_id || t.payrun_name}
                        style={{
                          padding: '0.85rem 1rem',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.5rem'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: '#FFF', fontSize: '0.9rem' }}>{t.payrun_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            {t.period_start} to {t.period_end} • {t.payslip_count} payslips
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, color: '#4ADE80', fontSize: '0.95rem' }}>
                            {formatCurrency(t.total_net)} <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400 }}>Net</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Gross: {formatCurrency(t.total_gross)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attendance & Leave Summaries */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Attendance Card */}
                <div className="glass-panel" style={{ padding: '1.25rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={16} color="#60A5FA" /> Attendance Overview
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
                    <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.7rem', color: '#4ADE80', fontWeight: 600 }}>Present</span>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF', marginTop: '0.1rem' }}>
                        {data.attendance.present_records}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.7rem', color: '#F87171', fontWeight: 600 }}>Absent</span>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF', marginTop: '0.1rem' }}>
                        {data.attendance.absent_records}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.7rem', color: '#60A5FA', fontWeight: 600 }}>Total Hours</span>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF', marginTop: '0.1rem' }}>
                        {data.attendance.total_worked_hours}h
                      </div>
                    </div>
                  </div>
                </div>

                {/* Time Off Card */}
                <div className="glass-panel" style={{ padding: '1.25rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={16} color="#FBBF24" /> Time Off & Leave Summary
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', textAlign: 'center', marginBottom: '1rem' }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.7rem', color: '#FBBF24', fontWeight: 600 }}>Pending</span>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF', marginTop: '0.1rem' }}>
                        {data.time_off.pending_requests}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.7rem', color: '#4ADE80', fontWeight: 600 }}>Approved</span>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF', marginTop: '0.1rem' }}>
                        {data.time_off.approved_requests}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.7rem', color: '#C084FC', fontWeight: 600 }}>Allocated</span>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF', marginTop: '0.1rem' }}>
                        {data.time_off.total_allocated_days}d
                      </div>
                    </div>
                  </div>

                  {data.time_off.total_allocated_days > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
                        <span>Used: {data.time_off.used_days} days</span>
                        <span>Remaining: {data.time_off.remaining_days} days</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, (data.time_off.used_days / data.time_off.total_allocated_days) * 100)}%`,
                            height: '100%',
                            background: '#FBBF24'
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Row 4: Live System Audit Warnings */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={18} color="#F87171" /> Compliance & System Audit Warnings ({data.warnings.length})
              </h3>

              {data.warnings.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4ADE80', fontSize: '0.875rem' }}>
                  <CheckCircle size={18} />
                  <span>No system compliance warnings detected. All active employees have contracts, schedules, and complete records.</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                  {data.warnings.map((w, idx) => {
                    const isError = w.severity === 'error';
                    const isWarn = w.severity === 'warning';

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '1rem',
                          borderRadius: 'var(--radius-md)',
                          background: isError ? 'rgba(239, 68, 68, 0.1)' : isWarn ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                          border: `1px solid ${isError ? 'rgba(239, 68, 68, 0.3)' : isWarn ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.75rem'
                        }}
                      >
                        {isError ? (
                          <AlertTriangle size={18} color="#F87171" style={{ flexShrink: 0, marginTop: '2px' }} />
                        ) : isWarn ? (
                          <AlertCircle size={18} color="#FBBF24" style={{ flexShrink: 0, marginTop: '2px' }} />
                        ) : (
                          <Info size={18} color="#60A5FA" style={{ flexShrink: 0, marginTop: '2px' }} />
                        )}

                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: isError ? '#F87171' : isWarn ? '#FBBF24' : '#60A5FA' }}>
                            {w.category}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#FFF', marginTop: '0.25rem' }}>
                            {w.message}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
