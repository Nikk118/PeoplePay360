'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { 
  Layers, Plus, Edit, Trash2, ArrowRight, CheckCircle, XCircle, 
  AlertCircle, Sliders, Search, ChevronRight, RefreshCw, ListFilter
} from 'lucide-react';

interface SalaryRule {
  id: string;
  structure_id: string;
  name: string;
  code: string;
  category: string;
  sequence: number;
  computation_type: string;
  fixed_amount: number;
  percentage: number;
  percentage_base?: string;
  formula?: string;
  active: boolean;
  appears_on_payslip: boolean;
}

interface SalaryStructure {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  rule_count: number;
  rules: SalaryRule[];
  created_at: string;
  updated_at: string;
}

export default function SalaryStructuresPage() {
  const { user, hasRole } = useAuth();
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingStruct, setEditingStruct] = useState<SalaryStructure | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirm Modal
  const [deletingStruct, setDeletingStruct] = useState<SalaryStructure | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchStructures();
  }, []);

  const fetchStructures = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<SalaryStructure[]>('/salary-structures');
      setStructures(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load salary structures');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (struct?: SalaryStructure) => {
    if (struct) {
      setEditingStruct(struct);
      setName(struct.name);
      setDescription(struct.description || '');
      setActive(struct.active);
    } else {
      setEditingStruct(null);
      setName('');
      setDescription('');
      setActive(true);
    }
    setShowModal(true);
  };

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      if (editingStruct) {
        await apiRequest(`/salary-structures/${editingStruct.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: name.trim(), description, active })
        });
      } else {
        await apiRequest('/salary-structures', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), description, active })
        });
      }
      setShowModal(false);
      fetchStructures();
    } catch (err: any) {
      setError(err.message || 'Failed to save salary structure');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStructure = async () => {
    if (!deletingStruct) return;
    setSubmitting(true);
    setDeleteError(null);

    try {
      await apiRequest(`/salary-structures/${deletingStruct.id}`, {
        method: 'DELETE'
      });
      setDeletingStruct(null);
      fetchStructures();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete salary structure');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStructures = structures.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const canManage = hasRole(['admin', 'hr_manager', 'hr_payroll_manager']);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
      <Navbar />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Top Header */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span className="badge badge-active" style={{ fontSize: '0.75rem' }}>Payroll Configuration</span>
            </div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Layers size={28} color="var(--primary)" />
              Salary Structures
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
              Manage salary structures and sequential computation rules for automated payroll processing.
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => handleOpenModal()}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem' }}
            >
              <Plus size={18} />
              New Salary Structure
            </button>
          )}
        </div>

        {/* Global Error Notification */}
        {error && (
          <div style={{
            background: 'var(--red-bg)',
            border: '1px solid var(--red-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--red)'
          }}>
            <AlertCircle size={20} />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{error}</span>
          </div>
        )}

        {/* Search Bar & Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
          background: 'var(--bg-card)',
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-glass)'
        }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder="Search structure by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-control"
              style={{ paddingLeft: '2.5rem', width: '100%' }}
            />
          </div>

          <button
            onClick={fetchStructures}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.85rem' }}
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Structures List Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
            <div className="animate-spin" style={{ width: '2rem', height: '2rem', border: '3px solid rgba(59, 130, 246, 0.3)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
            Loading salary structures...
          </div>
        ) : filteredStructures.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl)',
            border: '1px dashed var(--border-glass)'
          }}>
            <Layers size={48} color="var(--text-dim)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>No Salary Structures Found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
              {searchQuery ? 'No structures match your search criteria.' : 'Create your first salary structure to define payroll calculation rules.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
            {filteredStructures.map((struct) => (
              <div
                key={struct.id}
                className="glass-card"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <span className={`badge ${struct.active ? 'badge-active' : 'badge-inactive'}`} style={{ fontSize: '0.7rem', marginBottom: '0.5rem', display: 'inline-block' }}>
                        {struct.active ? 'Active' : 'Inactive'}
                      </span>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.3 }}>
                        {struct.name}
                      </h3>
                    </div>
                    <span style={{
                      background: 'var(--blue-bg)',
                      color: 'var(--blue)',
                      border: '1px solid var(--blue-border)',
                      padding: '0.25rem 0.65rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}>
                      {struct.rule_count} Rule{struct.rule_count !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <p style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {struct.description || 'No description provided.'}
                  </p>

                  {/* Rules preview chips */}
                  {struct.rules && struct.rules.length > 0 && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {struct.rules.slice(0, 5).map((rule) => (
                        <span key={rule.id} style={{
                          background: 'var(--bg-page)',
                          border: '1px solid var(--border-glass)',
                          fontSize: '0.7rem',
                          fontFamily: 'monospace',
                          color: 'var(--text-main)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '0.25rem'
                        }}>
                          {rule.code}
                        </span>
                      ))}
                      {struct.rules.length > 5 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', alignSelf: 'center' }}>
                          +{struct.rules.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div style={{
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-glass)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem'
                }}>
                  <Link
                    href={`/payroll/structures/${struct.id}`}
                    className="btn btn-primary"
                    style={{ flex: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem 0.85rem', fontSize: '0.85rem' }}
                  >
                    <Sliders size={16} />
                    Configure Rules
                    <ChevronRight size={14} />
                  </Link>

                  {canManage && (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        onClick={() => handleOpenModal(struct)}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)' }}
                        title="Edit Structure"
                      >
                        <Edit size={15} color="#9CA3AF" />
                      </button>
                      <button
                        onClick={() => { setDeletingStruct(struct); setDeleteError(null); }}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)' }}
                        title="Delete Structure"
                      >
                        <Trash2 size={15} color="#F87171" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create / Edit Structure Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
              {editingStruct ? 'Edit Salary Structure' : 'Create Salary Structure'}
            </h2>

            <form onSubmit={handleSaveStructure}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                  Structure Name <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Regular Salary Structure"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-control"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the structure purpose and applicable employee types..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <input
                  type="checkbox"
                  id="struct-active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <label htmlFor="struct-active" style={{ color: 'var(--text-main)', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 500 }}>
                  Active Structure (Available for contract assignment)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !name.trim()}
                >
                  {submitting ? 'Saving...' : editingStruct ? 'Update Structure' : 'Create Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingStruct && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--red)' }}>
              <AlertCircle size={28} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Delete Salary Structure</h3>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text-main)' }}>{deletingStruct.name}</strong>? This action will also delete all associated rules within this structure.
            </p>

            {deleteError && (
              <div style={{
                background: 'var(--red-bg)',
                border: '1px solid var(--red-border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                color: 'var(--red)',
                fontSize: '0.85rem'
              }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setDeletingStruct(null)}
                className="btn btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStructure}
                className="btn"
                style={{ background: '#DC2626', color: '#FFF', padding: '0.5rem 1.25rem' }}
                disabled={submitting}
              >
                {submitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
