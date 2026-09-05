'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Lock, Mail, ShieldCheck, UserCheck, Briefcase, Zap } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setError('');
    setLoading(true);
    try {
      await login(demoEmail, 'Password123!');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
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
      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem' }}>
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
            Integrated HR & Payroll Operations Platform
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--red-bg)',
            border: '1px solid var(--red-border)',
            color: 'var(--red)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            marginBottom: '1.25rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.8rem', marginTop: '0.5rem', fontSize: '0.95rem' }}
          >
            {loading ? 'Authenticating...' : 'Sign In to Platform'}
          </button>
        </form>

        <div style={{ margin: '1.75rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }}></div>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Demo Logins</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }}></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
          <button
            onClick={() => handleQuickLogin('hrmanager@peoplepay360.com')}
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.55rem', justifyContent: 'flex-start' }}
          >
            <UserCheck size={14} color="#3B82F6" /> HR Manager
          </button>
          
          <button
            onClick={() => handleQuickLogin('payrollmanager@peoplepay360.com')}
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.55rem', justifyContent: 'flex-start' }}
          >
            <Briefcase size={14} color="#10B981" /> Payroll Manager
          </button>

        <button
  onClick={() => handleQuickLogin('hrpayroll@peoplepay360.com')}
  className="btn-secondary"
  style={{ fontSize: '0.75rem', padding: '0.55rem', justifyContent: 'flex-start' }}
>
  <Briefcase size={14} color="#3B82F6" /> HR Payroll User
</button>

          <button
            onClick={() => handleQuickLogin('employee@peoplepay360.com')}
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.55rem', justifyContent: 'flex-start' }}
          >
            <Mail size={14} color="#F59E0B" /> Employee
          </button>

          <button
            onClick={() => handleQuickLogin('admin@peoplepay360.com')}
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.55rem', justifyContent: 'flex-start' }}
          >
            <ShieldCheck size={14} color="#8B5CF6" /> Admin
          </button>
        </div>
      </div>
    </div>
  );
}
