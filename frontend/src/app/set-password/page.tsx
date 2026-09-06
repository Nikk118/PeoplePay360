'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Zap, Shield, Mail, ArrowRight, RefreshCw } from 'lucide-react';

interface InvitationDetails {
  valid: boolean;
  email: string;
  employee_name?: string;
  role?: string;
}

const roleLabels: Record<string, string> = {
  hr_payroll_user: 'HR Payroll User',
  hr_manager: 'HR Manager',
  hr_payroll_manager: 'HR Payroll Manager',
  employee: 'Employee',
  admin: 'Administrator'
};

function SetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawToken = searchParams.get('token');
  const token = rawToken ? rawToken.trim().replace(/[/\s.]+$/, '') : null;

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadError('No invitation token provided. Please use the link sent to your email.');
      setLoading(false);
      return;
    }

    validateToken(token);
  }, [token]);

  const validateToken = async (tok: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const cleanTok = tok.trim().replace(/[/\s.]+$/, '');
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const res = await fetch(`${apiBase}/auth/validate-invitation?token=${encodeURIComponent(cleanTok)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'This invitation link is invalid or has expired.');
      }

      setInvitation(data);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to validate invitation link.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const cleanTok = (token || '').trim().replace(/[/\s.]+$/, '');
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const res = await fetch(`${apiBase}/auth/set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: cleanTok,
          password,
          confirm_password: confirmPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to set password.');
      }

      setSuccessMessage('Password set successfully! Redirecting you to sign in...');
      setTimeout(() => {
        router.push('/login');
      }, 2500);
    } catch (err: any) {
      setFormError(err.message || 'Failed to set password.');
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: 'radial-gradient(ellipse at top, #0F172A, #0B0F19)'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '2.5rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '1rem',
            background: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
            marginBottom: '1rem',
            boxShadow: '0 8px 20px rgba(59, 130, 246, 0.4)'
          }}>
            <Zap size={28} color="#FFF" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text-main)' }}>
            PeoplePay<span style={{ color: 'var(--primary)' }}>360</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
            Account Onboarding & Password Setup
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-muted)' }}>
            <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 1rem', color: '#3B82F6' }} />
            <p style={{ fontSize: '0.9rem' }}>Validating your invitation token...</p>
          </div>
        )}

        {/* Error State: Invalid or Expired Token */}
        {!loading && loadError && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: 'var(--red-bg)',
              border: '1px solid var(--red-border)',
              color: 'var(--red)',
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.9rem',
              marginBottom: '1.5rem',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem'
            }}>
              <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Invalid or Expired Invitation</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>{loadError}</div>
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Please ask your system administrator to generate a fresh invitation for your account.
            </p>

            <Link
              href="/login"
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                textDecoration: 'none',
                width: '100%',
                justifyContent: 'center',
                padding: '0.75rem'
              }}
            >
              Return to Login
            </Link>
          </div>
        )}

        {/* Success State */}
        {!loading && successMessage && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: 'var(--green-bg)',
              border: '1px solid var(--green-border)',
              color: 'var(--green)',
              padding: '1.5rem',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.5rem'
            }}>
              <CheckCircle size={42} style={{ margin: '0 auto 0.75rem' }} />
              <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.25rem' }}>Account Activated!</div>
              <div style={{ fontSize: '0.85rem' }}>{successMessage}</div>
            </div>

            <Link
              href="/login"
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                textDecoration: 'none',
                width: '100%',
                justifyContent: 'center',
                padding: '0.75rem'
              }}
            >
              Proceed to Sign In <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {/* Form State */}
        {!loading && !loadError && !successMessage && invitation && (
          <div>
            {/* Account Details Box */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <Mail size={14} color="#38BDF8" />
                <span>Account Email:</span>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{invitation.email}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <Shield size={14} color="#A855F7" />
                <span>Assigned Role:</span>
                <span className="badge" style={{
                  background: 'var(--blue-bg)',
                  color: 'var(--blue)',
                  border: '1px solid var(--blue-border)',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  {roleLabels[invitation.role || ''] || invitation.role || 'Employee'}
                </span>
              </div>
            </div>

            {formError && (
              <div style={{
                background: 'var(--red-bg)',
                border: '1px solid var(--red-border)',
                color: 'var(--red)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                  Create Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', width: '100%' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                  Confirm Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', width: '100%' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    style={{
                      position: 'absolute',
                      right: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Password checks */}
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: password.length >= 8 ? 'var(--green)' : 'var(--text-dim)' }}>
                  <CheckCircle size={13} /> Minimum 8 characters
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: password && password === confirmPassword ? 'var(--green)' : 'var(--text-dim)' }}>
                  <CheckCircle size={13} /> Passwords match
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '0.85rem',
                  marginTop: '0.5rem',
                  fontSize: '0.95rem',
                  fontWeight: 700
                }}
              >
                {submitting ? 'Setting Password...' : 'Set Password & Activate Account'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at top, #0F172A, #0B0F19)',
        color: 'var(--text-muted)'
      }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: '#3B82F6' }} />
      </div>
    }>
      <SetPasswordContent />
    </Suspense>
  );
}
