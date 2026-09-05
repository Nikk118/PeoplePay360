'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
  Tag, Plus, CheckCircle, XCircle, ArrowLeft, Shield 
} from 'lucide-react';

interface TimeOffType {
  id: string;
  name: string;
  code: string;
  unit: string;
  requires_allocation: boolean;
  requires_approval: boolean;
  affects_payroll: boolean;
  color: string;
  active: boolean;
}

export default function TimeOffTypesPage() {
  const { hasRole } = useAuth();
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    unit: 'days',
    requires_allocation: true,
    requires_approval: true,
    affects_payroll: false,
    color: '#3B82F6'
  });

  const loadTypes = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<TimeOffType[]>('/time-off/types');
      setTypes(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/time-off/types', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setShowModal(false);
      setName('');
      loadTypes();
    } catch (err: any) {
      alert(err.message || 'Failed to create leave type');
    }
  };

  const setName = (val: string) => {};

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Navbar />

      <main style={{ maxWidth: '1280px', margin: '2rem auto', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFF' }}>
              Time Off Types Setup
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Configure leave policy rules, allocation requirements, and payroll integration settings
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link href="/time-off/requests" className="btn-secondary">
              <ArrowLeft size={16} /> Back to Requests
            </Link>

            {hasRole(['hr_manager', 'admin']) && (
              <button onClick={() => setShowModal(true)} className="btn-primary">
                <Plus size={18} /> New Leave Type
              </button>
            )}
          </div>
        </div>

        {/* Types Table */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Type Name</th>
                <th>Code</th>
                <th>Unit</th>
                <th>Requires Allocation</th>
                <th>Requires Approval</th>
                <th>Affects Payroll</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>Loading leave types...</td></tr>
              ) : types.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>No leave types configured.</td></tr>
              ) : (
                types.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ width: '0.85rem', height: '0.85rem', borderRadius: '50%', background: t.color || '#3B82F6' }} />
                        <span style={{ fontWeight: 700, color: '#FFF' }}>{t.name}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#60A5FA' }}>{t.code}</td>
                    <td style={{ textTransform: 'capitalize' }}>{t.unit}</td>
                    <td>
                      <span className={`badge badge-${t.requires_allocation ? 'approved' : 'draft'}`}>
                        {t.requires_allocation ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${t.requires_approval ? 'approved' : 'draft'}`}>
                        {t.requires_approval ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${t.affects_payroll ? 'refused' : 'draft'}`}>
                        {t.affects_payroll ? 'Unpaid / Deducts Payroll' : 'Paid Leave'}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-active">Active</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal for Creating Leave Type */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#FFF', marginBottom: '1.25rem' }}>
                Configure New Time Off Type
              </h2>

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Type Name *</label>
                    <input type="text" required placeholder="e.g. Parental Leave" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="form-input" />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Code *</label>
                    <input type="text" required placeholder="e.g. PARENTAL" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="form-input" style={{ fontFamily: 'var(--font-mono)' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Unit</label>
                    <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="form-select">
                      <option value="days">Days</option>
                      <option value="hours">Hours</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Color Badge</label>
                    <input type="color" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} className="form-input" style={{ padding: '0.2rem', height: '2.5rem', cursor: 'pointer' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem', color: '#FFF', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.requires_allocation} onChange={e => setFormData({...formData, requires_allocation: e.target.checked})} style={{ width: '1rem', height: '1rem' }} />
                    Requires Allocation (Deducts from employee balance)
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem', color: '#FFF', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.requires_approval} onChange={e => setFormData({...formData, requires_approval: e.target.checked})} style={{ width: '1rem', height: '1rem' }} />
                    Requires HR Approval
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem', color: '#FFF', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.affects_payroll} onChange={e => setFormData({...formData, affects_payroll: e.target.checked})} style={{ width: '1rem', height: '1rem' }} />
                    Affects Payroll (Unpaid leave / deduction rule)
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Create Leave Type
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
