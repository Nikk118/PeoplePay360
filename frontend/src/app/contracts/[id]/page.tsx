'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
  FileText, Save, ArrowLeft, AlertTriangle, DollarSign, Calendar, Clock 
} from 'lucide-react';

interface ContractDetail {
  id: string;
  employee_id: string;
  employee_name?: string;
  name: string;
  contract_type?: string;
  department_id?: string;
  job_position?: string;
  job_title?: string;
  date_start: string;
  date_end?: string;
  wage: number;
  wage_type: string;
  salary_structure_id?: string;
  working_schedule_id?: string;
  status: string;
  notes?: string;
  has_overlap_warning: boolean;
}

interface WorkingSchedule {
  id: string;
  name: string;
}

export default function ContractEditPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { hasRole } = useAuth();

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [schedules, setSchedules] = useState<WorkingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      const [cData, sData] = await Promise.all([
        apiRequest<ContractDetail>(`/contracts/${id}`),
        apiRequest<WorkingSchedule[]>('/schedules')
      ]);
      setContract(cData);
      setSchedules(sData);
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
    if (!contract) return;
    setSaving(true);
    setSuccessMsg('');
    try {
      await apiRequest(`/contracts/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...contract,
          date_end: contract.date_end || null
        })
      });
      setSuccessMsg('Contract updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save contract');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !contract) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
        <Navbar />
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading contract details...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Navbar />

      <main style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1.5rem' }}>
        <Link href="/contracts" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          <ArrowLeft size={16} /> Back to Contracts
        </Link>

        {contract.has_overlap_warning && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <AlertTriangle size={20} />
            <div>
              <strong>Overlapping Active Contract Warning:</strong> This employee has another active contract covering overlapping dates. Please verify contract start/end dates.
            </div>
          </div>
        )}

        {successMsg && (
          <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', color: 'var(--green)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {successMsg}
          </div>
        )}

        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {contract.name}
              </h1>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Employee: <strong style={{ color: 'var(--text-main)' }}>{contract.employee_name}</strong>
              </div>
            </div>
            <span className={`badge badge-${contract.status}`}>
              {contract.status}
            </span>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Contract Title</label>
                <input type="text" required value={contract.name} onChange={e => setContract({...contract, name: e.target.value})} className="form-input" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Contract Type</label>
                <select value={contract.contract_type || 'permanent'} onChange={e => setContract({...contract, contract_type: e.target.value})} className="form-select">
                  <option value="permanent">Permanent</option>
                  <option value="fixed_term">Fixed Term</option>
                  <option value="internship">Internship</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Contract Wage (Base Wage)</label>
                <input type="number" required value={contract.wage} onChange={e => setContract({...contract, wage: parseFloat(e.target.value)})} className="form-input" style={{ fontFamily: 'var(--font-mono)' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Wage Type</label>
                <select value={contract.wage_type} onChange={e => setContract({...contract, wage_type: e.target.value})} className="form-select">
                  <option value="monthly">Monthly</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Start Date</label>
                <input type="date" required value={contract.date_start} onChange={e => setContract({...contract, date_start: e.target.value})} className="form-input" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>End Date (Leave blank for open-ended)</label>
                <input type="date" value={contract.date_end || ''} onChange={e => setContract({...contract, date_end: e.target.value})} className="form-input" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Working Schedule Override</label>
                <select value={contract.working_schedule_id || ''} onChange={e => setContract({...contract, working_schedule_id: e.target.value})} className="form-select">
                  <option value="">Default Schedule</option>
                  {schedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Contract Status</label>
                <select value={contract.status} onChange={e => setContract({...contract, status: e.target.value})} className="form-select">
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Contract Notes</label>
              <textarea rows={3} value={contract.notes || ''} onChange={e => setContract({...contract, notes: e.target.value})} className="form-input" placeholder="Terms, position details..." />
            </div>

            {hasRole(['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin']) && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '0.75rem 1.75rem' }}>
                  <Save size={18} /> {saving ? 'Saving...' : 'Save Contract'}
                </button>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
