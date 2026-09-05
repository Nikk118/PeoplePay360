'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { 
  ArrowLeft, Plus, Edit, Trash2, Sliders, CheckCircle, XCircle, 
  AlertCircle, Eye, EyeOff, Code, Percent, DollarSign, Calculator,
  ArrowDown, Info, RefreshCw
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
  created_at: string;
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

export default function SalaryStructureDetailPage() {
  const params = useParams();
  const router = useRouter();
  const structureId = params.id as string;
  const { hasRole } = useAuth();

  const [structure, setStructure] = useState<SalaryStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State for Rule
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<SalaryRule | null>(null);

  // Rule Form State
  const [ruleName, setRuleName] = useState('');
  const [ruleCode, setRuleCode] = useState('');
  const [category, setCategory] = useState('allowance');
  const [sequence, setSequence] = useState(10);
  const [computationType, setComputationType] = useState('fixed');
  const [fixedAmount, setFixedAmount] = useState<number | ''>(0);
  const [percentage, setPercentage] = useState<number | ''>(0);
  const [percentageBase, setPercentageBase] = useState('contract_wage');
  const [formula, setFormula] = useState('');
  const [ruleActive, setRuleActive] = useState(true);
  const [appearsOnPayslip, setAppearsOnPayslip] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete Rule State
  const [deletingRule, setDeletingRule] = useState<SalaryRule | null>(null);

  useEffect(() => {
    if (structureId) {
      fetchStructureDetails();
    }
  }, [structureId]);

  const fetchStructureDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<SalaryStructure>(`/salary-structures/${structureId}`);
      setStructure(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load salary structure details');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRuleModal = (rule?: SalaryRule) => {
    setModalError(null);
    if (rule) {
      setEditingRule(rule);
      setRuleName(rule.name);
      setRuleCode(rule.code);
      setCategory(rule.category);
      setSequence(rule.sequence);
      setComputationType(rule.computation_type);
      setFixedAmount(rule.fixed_amount);
      setPercentage(rule.percentage);
      setPercentageBase(rule.percentage_base || 'BASIC');
      setFormula(rule.formula || '');
      setRuleActive(rule.active);
      setAppearsOnPayslip(rule.appears_on_payslip);
    } else {
      setEditingRule(null);
      setRuleName('');
      setRuleCode('');
      setCategory('allowance');
      // Auto-suggest next sequence (e.g. highest sequence + 10)
      const maxSeq = structure?.rules && structure.rules.length > 0
        ? Math.max(...structure.rules.map(r => r.sequence))
        : 0;
      setSequence(maxSeq + 10);
      setComputationType('fixed');
      setFixedAmount(0);
      setPercentage(0);
      setPercentageBase('BASIC');
      setFormula('');
      setRuleActive(true);
      setAppearsOnPayslip(true);
    }
    setShowRuleModal(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !ruleCode.trim()) {
      setModalError('Rule Name and Code are required.');
      return;
    }

    setSubmitting(true);
    setModalError(null);

    const payload = {
      structure_id: structureId,
      name: ruleName.trim(),
      code: ruleCode.trim().toUpperCase(),
      category,
      sequence: Number(sequence),
      computation_type: computationType,
      fixed_amount: Number(fixedAmount) || 0.0,
      percentage: Number(percentage) || 0.0,
      percentage_base: computationType === 'percentage' ? percentageBase : null,
      formula: computationType === 'formula' ? formula.trim() : null,
      active: ruleActive,
      appears_on_payslip: appearsOnPayslip
    };

    try {
      if (editingRule) {
        await apiRequest(`/salary-rules/${editingRule.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiRequest('/salary-rules', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      setShowRuleModal(false);
      fetchStructureDetails();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save salary rule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deletingRule) return;
    setSubmitting(true);

    try {
      await apiRequest(`/salary-rules/${deletingRule.id}`, {
        method: 'DELETE'
      });
      setDeletingRule(null);
      fetchStructureDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to delete salary rule');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'basic': return 'badge-active';
      case 'allowance': return 'badge-pending';
      case 'gross': return 'badge-active';
      case 'deduction': return 'badge-expired';
      case 'net': return 'badge-approved';
      default: return 'badge-draft';
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'basic': return '#3B82F6';
      case 'allowance': return '#10B981';
      case 'gross': return '#8B5CF6';
      case 'deduction': return '#EF4444';
      case 'net': return '#EC4899';
      default: return '#6B7280';
    }
  };

  const canManage = hasRole(['admin', 'hr_manager', 'hr_payroll_manager']);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
      <Navbar />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Back Link & Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href="/payroll/structures"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--primary)',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
              marginBottom: '1rem'
            }}
          >
            <ArrowLeft size={16} />
            Back to Salary Structures
          </Link>

          {loading ? (
            <div style={{ padding: '2rem 0', color: 'var(--text-muted)' }}>Loading structure details...</div>
          ) : error || !structure ? (
            <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', padding: '1rem', borderRadius: 'var(--radius-lg)', color: 'var(--red)' }}>
              {error || 'Salary structure not found'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
                  <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                    {structure.name}
                  </h1>
                  <span className={`badge ${structure.active ? 'badge-active' : 'badge-inactive'}`}>
                    {structure.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  {structure.description || 'No description provided.'}
                </p>
              </div>

              {canManage && (
                <button
                  onClick={() => handleOpenRuleModal()}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem' }}
                >
                  <Plus size={18} />
                  Add Salary Rule
                </button>
              )}
            </div>
          )}
        </div>

        {structure && (
          <>
            {/* Quick Stats Banner */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--blue-bg)', borderRadius: 'var(--radius-md)', color: 'var(--blue)' }}>
                  <Sliders size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Rules</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{structure.rule_count}</div>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--green-bg)', borderRadius: 'var(--radius-md)', color: 'var(--green)' }}>
                  <DollarSign size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fixed Rules</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {structure.rules.filter(r => r.computation_type === 'fixed').length}
                  </div>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--yellow-bg)', borderRadius: 'var(--radius-md)', color: 'var(--yellow)' }}>
                  <Percent size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Percentage Rules</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {structure.rules.filter(r => r.computation_type === 'percentage').length}
                  </div>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--purple-bg)', borderRadius: 'var(--radius-md)', color: 'var(--purple)' }}>
                  <Calculator size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Formula Rules</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {structure.rules.filter(r => r.computation_type === 'formula').length}
                  </div>
                </div>
              </div>
            </div>

            {/* Sequence Banner Note */}
            <div style={{
              background: 'rgba(37, 99, 235, 0.08)',
              border: '1px solid rgba(37, 99, 235, 0.25)',
              borderRadius: 'var(--radius-lg)',
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem'
            }}>
              <Info size={22} color="var(--primary)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--primary)' }}>Execution Order Matters:</strong> Payroll calculation processes rules strictly in order of <strong>Sequence (ascending)</strong>. Later rules can safely reference codes computed by earlier rules in formulas and percentage calculations.
              </div>
            </div>

            {/* Rules Table List */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-glass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Salary Rules Sequence
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Ordered by Sequence
                </span>
              </div>

              {structure.rules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No rules configured in this salary structure yet. Click "+ Add Salary Rule" to get started.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.85rem 1.25rem', width: '90px' }}>Seq #</th>
                        <th style={{ padding: '0.85rem 1rem', width: '110px' }}>Code</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Rule Name</th>
                        <th style={{ padding: '0.85rem 1rem', width: '130px' }}>Category</th>
                        <th style={{ padding: '0.85rem 1rem', width: '120px' }}>Type</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Computation Specification</th>
                        <th style={{ padding: '0.85rem 1rem', width: '90px', textAlign: 'center' }}>Payslip</th>
                        <th style={{ padding: '0.85rem 1rem', width: '90px', textAlign: 'center' }}>Status</th>
                        {canManage && <th style={{ padding: '0.85rem 1.25rem', width: '100px', textAlign: 'right' }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {structure.rules.map((rule, idx) => (
                        <tr
                          key={rule.id}
                          style={{
                            borderBottom: '1px solid var(--border-glass)',
                            transition: 'background 0.15s ease',
                            background: rule.active ? 'transparent' : 'rgba(239, 68, 68, 0.03)'
                          }}
                        >
                          {/* Sequence Badge */}
                          <td style={{ padding: '0.85rem 1.25rem' }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '2.25rem',
                              height: '2.25rem',
                              borderRadius: '0.5rem',
                              background: 'var(--blue-bg)',
                              border: '1px solid var(--blue-border)',
                              color: 'var(--blue)',
                              fontWeight: 700,
                              fontSize: '0.85rem'
                            }}>
                              {rule.sequence}
                            </div>
                          </td>

                          {/* Code */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              color: 'var(--primary)',
                              background: 'rgba(37, 99, 235, 0.08)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '0.25rem',
                              border: '1px solid rgba(37, 99, 235, 0.2)'
                            }}>
                              {rule.code}
                            </span>
                          </td>

                          {/* Name */}
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            {rule.name}
                          </td>

                          {/* Category */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              padding: '0.25rem 0.6rem',
                              borderRadius: 'var(--radius-full)',
                              background: `${getCategoryColor(rule.category)}20`,
                              color: getCategoryColor(rule.category),
                              border: `1px solid ${getCategoryColor(rule.category)}40`
                            }}>
                              {rule.category}
                            </span>
                          </td>

                          {/* Computation Type */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              color: 'var(--text-muted)',
                              textTransform: 'capitalize',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}>
                              {rule.computation_type === 'fixed' && <DollarSign size={14} color="#34D399" />}
                              {rule.computation_type === 'percentage' && <Percent size={14} color="#FBBF24" />}
                              {rule.computation_type === 'formula' && <Calculator size={14} color="#A78BFA" />}
                              {rule.computation_type}
                            </span>
                          </td>

                          {/* Specification */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            {rule.computation_type === 'fixed' && (
                              <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                                ₹{rule.fixed_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                            {rule.computation_type === 'percentage' && (
                              <span style={{ color: 'var(--yellow)', fontWeight: 600 }}>
                                {rule.percentage}% of <code style={{ background: 'var(--bg-page)', padding: '0.15rem 0.35rem', borderRadius: '0.2rem', color: 'var(--text-main)', border: '1px solid var(--border-glass)' }}>{rule.percentage_base || 'BASIC'}</code>
                              </span>
                            )}
                            {rule.computation_type === 'formula' && (
                              <code style={{
                                background: 'var(--bg-page)',
                                border: '1px solid var(--border-glass)',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '0.35rem',
                                color: 'var(--purple)',
                                fontSize: '0.8rem',
                                fontFamily: 'monospace'
                              }}>
                                {rule.formula}
                              </code>
                            )}
                          </td>

                          {/* Payslip Visibility */}
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                            {rule.appears_on_payslip ? (
                              <span title="Visible on Payslip"><Eye size={16} color="var(--green)" style={{ margin: '0 auto' }} /></span>
                            ) : (
                              <span title="Hidden from Payslip"><EyeOff size={16} color="var(--text-dim)" style={{ margin: '0 auto' }} /></span>
                            )}
                          </td>

                          {/* Active */}
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                            <span className={`badge ${rule.active ? 'badge-active' : 'badge-inactive'}`} style={{ fontSize: '0.7rem' }}>
                              {rule.active ? 'Active' : 'Off'}
                            </span>
                          </td>

                          {/* Actions */}
                          {canManage && (
                            <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                <button
                                  onClick={() => handleOpenRuleModal(rule)}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.35rem', borderRadius: 'var(--radius-md)' }}
                                  title="Edit Rule"
                                >
                                  <Edit size={14} color="#9CA3AF" />
                                </button>
                                <button
                                  onClick={() => setDeletingRule(rule)}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.35rem', borderRadius: 'var(--radius-md)' }}
                                  title="Delete Rule"
                                >
                                  <Trash2 size={14} color="#F87171" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Create / Edit Rule Modal */}
      {showRuleModal && (
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
          padding: '1rem',
          overflowY: 'auto'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '600px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
              {editingRule ? `Edit Salary Rule (${editingRule.code})` : 'Add New Salary Rule'}
            </h2>

            {modalError && (
              <div style={{
                background: 'var(--red-bg)',
                border: '1px solid var(--red-border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                color: 'var(--red)',
                fontSize: '0.85rem'
              }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveRule}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    Rule Name <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. House Rent Allowance"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="form-control"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    Rule Code <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HRA"
                    value={ruleCode}
                    onChange={(e) => setRuleCode(e.target.value.toUpperCase())}
                    className="form-control"
                    style={{ width: '100%', fontFamily: 'monospace', textTransform: 'uppercase' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="form-control"
                    style={{ width: '100%' }}
                  >
                    <option value="basic">Basic</option>
                    <option value="allowance">Allowance</option>
                    <option value="gross">Gross</option>
                    <option value="deduction">Deduction</option>
                    <option value="net">Net</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    Sequence # <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={sequence}
                    onChange={(e) => setSequence(parseInt(e.target.value) || 10)}
                    className="form-control"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    Computation Type
                  </label>
                  <select
                    value={computationType}
                    onChange={(e) => setComputationType(e.target.value)}
                    className="form-control"
                    style={{ width: '100%' }}
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percentage">Percentage (%)</option>
                    <option value="formula">Formula Expression</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Inputs Based on Computation Type */}
              <div style={{
                background: 'var(--bg-page)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                marginBottom: '1.25rem'
              }}>
                {computationType === 'fixed' && (
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                      Fixed Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={fixedAmount}
                      onChange={(e) => setFixedAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="form-control"
                      style={{ width: '100%' }}
                    />
                  </div>
                )}

                {computationType === 'percentage' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                        Percentage (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 20 for 20% or -12 for -12%"
                        value={percentage}
                        onChange={(e) => setPercentage(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="form-control"
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                        Percentage Base Code
                      </label>
                      <select
                        value={percentageBase}
                        onChange={(e) => setPercentageBase(e.target.value)}
                        className="form-control"
                        style={{ width: '100%' }}
                      >
                        <option value="contract_wage">contract_wage (Monthly Base)</option>
                        {structure?.rules.map(r => (
                          <option key={r.id} value={r.code}>{r.code} ({r.name})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {computationType === 'formula' && (
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                      Formula Expression
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. BASIC + HRA + MA + TA"
                      value={formula}
                      onChange={(e) => setFormula(e.target.value)}
                      className="form-control"
                      style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.9rem' }}
                    />

                    {/* Quick Code Insert Chips */}
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                        Click variable to insert into formula:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {['contract_wage', 'time_off_unpaid_days', ...(structure?.rules.map(r => r.code) || [])].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setFormula(prev => prev ? `${prev} ${item}` : item)}
                            style={{
                              background: 'var(--blue-bg)',
                              border: '1px solid var(--blue-border)',
                              color: 'var(--blue)',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '0.25rem',
                              cursor: 'pointer'
                            }}
                          >
                            +{item}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Toggles */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="rule-active"
                    checked={ruleActive}
                    onChange={(e) => setRuleActive(e.target.checked)}
                    style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <label htmlFor="rule-active" style={{ color: 'var(--text-main)', fontSize: '0.875rem', cursor: 'pointer' }}>
                    Active Rule
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="rule-payslip"
                    checked={appearsOnPayslip}
                    onChange={(e) => setAppearsOnPayslip(e.target.checked)}
                    style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <label htmlFor="rule-payslip" style={{ color: 'var(--text-main)', fontSize: '0.875rem', cursor: 'pointer' }}>
                    Appears on Payslip
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !ruleName.trim() || !ruleCode.trim()}
                >
                  {submitting ? 'Saving...' : editingRule ? 'Update Rule' : 'Add Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Rule Confirmation */}
      {deletingRule && (
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
          <div className="glass-card" style={{ width: '100%', maxWidth: '450px', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--red)' }}>
              <AlertCircle size={28} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Delete Salary Rule</h3>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Are you sure you want to delete rule <strong style={{ color: 'var(--text-main)' }}>{deletingRule.name} ({deletingRule.code})</strong>?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setDeletingRule(null)}
                className="btn btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRule}
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
