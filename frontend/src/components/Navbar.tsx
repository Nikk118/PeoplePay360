'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Users, FileText, Clock, Calendar, DollarSign, BarChart2, LogOut, Shield, Zap, Layers
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout, hasRole } = useAuth();

  if (!user) return null;

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  return (
    <nav style={{
      background: 'rgba(17, 24, 39, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-glass)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '0 1.5rem'
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        height: '4rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Brand */}
        <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '2.25rem',
            height: '2.25rem',
            borderRadius: '0.6rem',
            background: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)'
          }}>
            <Zap size={18} color="#FFF" />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFF', letterSpacing: '-0.02em' }}>
            PeoplePay<span style={{ color: '#3B82F6' }}>360</span>
          </span>
        </Link>

        {/* Navigation Items */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Link
            href="/employees"
            className="nav-link"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              color: isActive('/employees') ? '#FFF' : 'var(--text-muted)',
              background: isActive('/employees') ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              border: isActive('/employees') ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
            }}
          >
            <Users size={16} color={isActive('/employees') ? '#60A5FA' : 'var(--text-dim)'} />
            Employees
          </Link>

          {hasRole(['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin']) && (
            <Link
              href="/contracts"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
                color: isActive('/contracts') ? '#FFF' : 'var(--text-muted)',
                background: isActive('/contracts') ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                border: isActive('/contracts') ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
              }}
            >
              <FileText size={16} color={isActive('/contracts') ? '#60A5FA' : 'var(--text-dim)'} />
              Contracts
            </Link>
          )}

          <Link
            href="/attendance"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              color: isActive('/attendance') ? '#FFF' : 'var(--text-muted)',
              background: isActive('/attendance') ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              border: isActive('/attendance') ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
            }}
          >
            <Clock size={16} color={isActive('/attendance') ? '#60A5FA' : 'var(--text-dim)'} />
            Attendance
          </Link>

          <Link
            href="/time-off/requests"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              color: isActive('/time-off') ? '#FFF' : 'var(--text-muted)',
              background: isActive('/time-off') ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              border: isActive('/time-off') ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
            }}
          >
            <Calendar size={16} color={isActive('/time-off') ? '#60A5FA' : 'var(--text-dim)'} />
            Time Off
          </Link>

          {hasRole(['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin']) && (
            <Link
              href="/payroll/structures"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
                color: isActive('/payroll/structures') ? '#FFF' : 'var(--text-muted)',
                background: isActive('/payroll/structures') ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                border: isActive('/payroll/structures') ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
              }}
            >
              <Layers size={16} color={isActive('/payroll/structures') ? '#60A5FA' : 'var(--text-dim)'} />
              Structures
            </Link>
          )}

          {hasRole(['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin']) && (
            <Link
              href="/payroll/payruns"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
                color: isActive('/payroll/payruns') ? '#FFF' : 'var(--text-muted)',
                background: isActive('/payroll/payruns') ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                border: isActive('/payroll/payruns') ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
              }}
            >
              <DollarSign size={16} color={isActive('/payroll/payruns') ? '#60A5FA' : 'var(--text-dim)'} />
              Payruns
            </Link>
          )}

          <Link
            href="/payroll/payslips"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              color: isActive('/payroll/payslips') ? '#FFF' : 'var(--text-muted)',
              background: isActive('/payroll/payslips') ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              border: isActive('/payroll/payslips') ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
            }}
          >
            <FileText size={16} color={isActive('/payroll/payslips') ? '#60A5FA' : 'var(--text-dim)'} />
            Payslips
          </Link>

          <Link
            href="/reports/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              color: isActive('/reports') || isActive('/dashboard') ? '#FFF' : 'var(--text-muted)',
              background: isActive('/reports') || isActive('/dashboard') ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              border: isActive('/reports') || isActive('/dashboard') ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
            }}
          >
            <BarChart2 size={16} color={isActive('/reports') || isActive('/dashboard') ? '#60A5FA' : 'var(--text-dim)'} />
            Reports
          </Link>
        </div>

        {/* User Pill & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-glass)',
            padding: '0.35rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem'
          }}>
            <Shield size={14} color="#3B82F6" />
            <span style={{ fontWeight: 600, color: '#FFF' }}>{user.email.split('@')[0]}</span>
            <span className="badge badge-active" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
              {user.roles[0]?.toUpperCase() || 'USER'}
            </span>
          </div>

          <button
            onClick={logout}
            title="Sign out"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '0.4rem',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
}
