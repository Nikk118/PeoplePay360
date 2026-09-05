'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, Clock, Plus, Trash2, CheckCircle, ArrowLeft, Shield 
} from 'lucide-react';

interface ScheduleLine {
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_duration_minutes: number;
}

interface WorkingSchedule {
  id: string;
  name: string;
  schedule_type: string;
  weekly_hours: number;
  lines: ScheduleLine[];
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function WorkingSchedulesPage() {
  const { hasRole } = useAuth();
  const [schedules, setSchedules] = useState<WorkingSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [scheduleType, setScheduleType] = useState('standard');
  const [lines, setLines] = useState<ScheduleLine[]>([
    { day_of_week: 0, start_time: '09:00', end_time: '17:30', break_duration_minutes: 30 },
    { day_of_week: 1, start_time: '09:00', end_time: '17:30', break_duration_minutes: 30 },
    { day_of_week: 2, start_time: '09:00', end_time: '17:30', break_duration_minutes: 30 },
    { day_of_week: 3, start_time: '09:00', end_time: '17:30', break_duration_minutes: 30 },
    { day_of_week: 4, start_time: '09:00', end_time: '17:30', break_duration_minutes: 30 },
  ]);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<WorkingSchedule[]>('/schedules');
      setSchedules(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const calculatePreviewHours = () => {
    let totalMinutes = 0;
    lines.forEach(l => {
      if (l.start_time && l.end_time) {
        const [sh, sm] = l.start_time.split(':').map(Number);
        const [eh, em] = l.end_time.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const netMin = Math.max(0, (endMin - startMin) - (l.break_duration_minutes || 0));
        totalMinutes += netMin;
      }
    });
    return (totalMinutes / 60).toFixed(2);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/schedules', {
        method: 'POST',
        body: JSON.stringify({
          name,
          schedule_type: scheduleType,
          lines: lines.map(l => ({
            ...l,
            start_time: l.start_time.length === 5 ? `${l.start_time}:00` : l.start_time,
            end_time: l.end_time.length === 5 ? `${l.end_time}:00` : l.end_time
          }))
        })
      });
      setShowModal(false);
      setName('');
      loadSchedules();
    } catch (err: any) {
      alert(err.message || 'Failed to create working schedule');
    }
  };

  const toggleDay = (dayIdx: number) => {
    const exists = lines.find(l => l.day_of_week === dayIdx);
    if (exists) {
      setLines(lines.filter(l => l.day_of_week !== dayIdx));
    } else {
      setLines([...lines, { day_of_week: dayIdx, start_time: '09:00', end_time: '17:30', break_duration_minutes: 30 }].sort((a,b) => a.day_of_week - b.day_of_week));
    }
  };

  const updateLine = (dayIdx: number, field: string, value: any) => {
    setLines(lines.map(l => {
      if (l.day_of_week === dayIdx) {
        return { ...l, [field]: value };
      }
      return l;
    }));
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
      <Navbar />

      <main style={{ maxWidth: '1280px', margin: '2rem auto', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Working Schedules
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Define weekly work patterns with auto-calculated weekly hours for attendance & payroll expectations
            </p>
          </div>

          {hasRole(['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin']) && (
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus size={18} /> New Schedule Pattern
            </button>
          )}
        </div>

        {/* Schedules Grid */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading working schedules...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
            {schedules.map(sched => (
              <div key={sched.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {sched.name}
                      </h3>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: '0.2rem' }}>
                        {sched.schedule_type} schedule
                      </div>
                    </div>

                    <div style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue-border)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)', textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}>
                        {sched.weekly_hours} hrs
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Weekly Hours</div>
                    </div>
                  </div>

                  {/* Day breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '1rem' }}>
                    {DAYS_OF_WEEK.map((dayName, idx) => {
                      const line = sched.lines.find(l => l.day_of_week === idx);
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-sm)', background: line ? 'var(--bg-page)' : 'transparent', opacity: line ? 1 : 0.5 }}>
                          <span style={{ fontWeight: 600, color: line ? 'var(--text-main)' : 'var(--text-dim)' }}>{dayName}</span>
                          {line ? (
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 600 }}>
                              {line.start_time.slice(0,5)} – {line.end_time.slice(0,5)} ({line.break_duration_minutes}m break)
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-dim)' }}>Off</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal for Creating Working Schedule */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '650px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Define Weekly Working Schedule
                </h2>
                <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-md)', color: 'var(--green)', fontSize: '0.85rem', fontWeight: 700 }}>
                  Derived Total: {calculatePreviewHours()} hrs/week
                </div>
              </div>

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Schedule Name *</label>
                    <input type="text" required placeholder="e.g. Standard 40h (Mon-Fri)" value={name} onChange={e => setName(e.target.value)} className="form-input" />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Schedule Type</label>
                    <select value={scheduleType} onChange={e => setScheduleType(e.target.value)} className="form-select">
                      <option value="standard">Standard Fixed</option>
                      <option value="flexible">Flexible Shift</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                    Weekly Working Days & Shift Timings
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {DAYS_OF_WEEK.map((dayName, idx) => {
                      const activeLine = lines.find(l => l.day_of_week === idx);
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', background: activeLine ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-page)', border: '1px solid var(--border-glass)' }}>
                          <input
                            type="checkbox"
                            checked={!!activeLine}
                            onChange={() => toggleDay(idx)}
                            style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                          />
                          <span style={{ width: '90px', fontWeight: 600, fontSize: '0.85rem', color: activeLine ? 'var(--text-main)' : 'var(--text-dim)' }}>
                            {dayName}
                          </span>

                          {activeLine ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                              <input
                                type="time"
                                value={activeLine.start_time}
                                onChange={e => updateLine(idx, 'start_time', e.target.value)}
                                className="form-input"
                                style={{ width: '110px', padding: '0.35rem' }}
                              />
                              <span style={{ color: 'var(--text-muted)' }}>to</span>
                              <input
                                type="time"
                                value={activeLine.end_time}
                                onChange={e => updateLine(idx, 'end_time', e.target.value)}
                                className="form-input"
                                style={{ width: '110px', padding: '0.35rem' }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Break:</span>
                              <input
                                type="number"
                                placeholder="min"
                                value={activeLine.break_duration_minutes}
                                onChange={e => updateLine(idx, 'break_duration_minutes', parseInt(e.target.value) || 0)}
                                className="form-input"
                                style={{ width: '70px', padding: '0.35rem' }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>m</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>Off / Non-working day</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Create Schedule
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
