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

  const linkStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.45rem 0.8rem',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontWeight: 500,
    textDecoration: 'none',
    color: active ? '#1E3A5F' : '#6B7280',
    background: active ? '#EBF0F7' : 'transparent',
    borderBottom: active ? '2px solid #1E3A5F' : '2px solid transparent',
    transition: 'all 0.15s ease',
  });

  return (
    <nav style={{
      background: '#FFFFFF',
      borderBottom: '1px solid #E2E6ED',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '0 1.5rem',
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        height: '3.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>

        {/* Brand */}
        <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '6px',
            background: '#1E3A5F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Zap size={14} color="#FFFFFF" />
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A1D23', letterSpacing: '-0.01em' }}>
            PeoplePay<span style={{ color: '#1E3A5F' }}>360</span>
          </span>
        </Link>

        {/* Navigation */}
        {(() => {
          const isEmployeeOnly = !user.roles.some(r => ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'].includes(r)) && user.roles.includes('employee');

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
              <Link href="/employees" style={linkStyle(isActive('/employees'))}>
                <Users size={15} /> {isEmployeeOnly ? 'My Profile' : 'Employees'}
              </Link>

              {hasRole(['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin']) && (
                <Link href="/contracts" style={linkStyle(isActive('/contracts'))}>
                  <FileText size={15} /> Contracts
                </Link>
              )}

              <Link href="/attendance" style={linkStyle(isActive('/attendance'))}>
                <Clock size={15} /> {isEmployeeOnly ? 'My Attendance' : 'Attendance'}
              </Link>

              <Link href="/time-off/requests" style={linkStyle(isActive('/time-off'))}>
                <Calendar size={15} /> {isEmployeeOnly ? 'My Time Off' : 'Time Off'}
              </Link>

              {hasRole(['hr_payroll_user', 'hr_payroll_manager', 'admin']) && (
                <Link href="/payroll/structures" style={linkStyle(isActive('/payroll/structures'))}>
                  <Layers size={15} /> Structures
                </Link>
              )}

              {hasRole(['hr_payroll_user', 'hr_payroll_manager', 'admin']) && (
                <Link href="/payroll/payruns" style={linkStyle(isActive('/payroll/payruns'))}>
                  <DollarSign size={15} /> Payruns
                </Link>
              )}

              {!(hasRole(['hr_manager']) && !hasRole(['admin', 'hr_payroll_user', 'hr_payroll_manager'])) && (
                <Link href="/payroll/payslips" style={linkStyle(isActive('/payroll/payslips'))}>
                  <FileText size={15} /> {isEmployeeOnly ? 'My Payslips' : 'Payslips'}
                </Link>
              )}

              {hasRole(['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin']) && (
                <Link href="/reports/dashboard" style={linkStyle(isActive('/reports') || isActive('/dashboard'))}>
                  <BarChart2 size={15} /> Reports
                </Link>
              )}

              {hasRole(['admin']) && (
                <Link href="/admin/users" style={linkStyle(isActive('/admin/users'))}>
                  <Shield size={15} /> Users
                </Link>
              )}
            </div>
          );
        })()}

        {/* User info + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
            color: '#6B7280',
          }}>
            <Shield size={14} color="var(--primary)" />
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{user.email.split('@')[0]}</span>
            <span style={{
              background: '#EBF0F7',
              color: '#1E3A5F',
              border: '1px solid #C5D5E8',
              borderRadius: '4px',
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: '0.1rem 0.45rem',
              letterSpacing: '0.04em',
            }}>
              {user.roles[0]?.toUpperCase() || 'USER'}
            </span>
          </div>

          <button
            onClick={logout}
            title="Sign out"
            style={{
              background: 'transparent',
              border: '1px solid #E2E6ED',
              color: '#6B7280',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '0.4rem',
              borderRadius: '6px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#FECACA';
              (e.currentTarget as HTMLButtonElement).style.color = '#DC2626';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E6ED';
              (e.currentTarget as HTMLButtonElement).style.color = '#6B7280';
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
}
