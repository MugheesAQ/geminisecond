import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  CalendarCheck,
  ShieldAlert,
} from 'lucide-react';
import { apiFetch, UserSession } from '../../lib/api.ts';

interface Appointment {
  id: string;
  contactId: string;
  userId: string;
  title: string;
  startTime: string;
  endTime: string;
  timezone: string;
  status: 'confirmed' | 'rescheduled' | 'cancelled';
  createdAt: string;
}

export const CalendarManager: React.FC<{ session: UserSession | null }> = ({ session }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [contactId, setContactId] = useState('');
  const [userId, setUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [conflictError, setConflictError] = useState('');

  const fetchData = async () => {
    try {
      const [contRes, teamRes] = await Promise.all([
        apiFetch<any[]>('/api/crm/contacts'),
        apiFetch<any[]>('/api/team/members'),
      ]);
      setContacts(contRes);
      setTeamMembers(teamRes);

      // Fetch appointments through contact 360 aggregator
      const aptsList = await Promise.all(
        contRes.map(async (c) => {
          try {
            const data = await apiFetch(`/api/crm/contacts/${c.id}/360`);
            return data.appointments || [];
          } catch {
            return [];
          }
        })
      );

      const flat = Array.from(new Map(aptsList.flat().map((a) => [a.id, a])).values()) as Appointment[];
      setAppointments(flat);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError('');

    if (!startDate || !startTime) {
      alert('Please specify date and time');
      return;
    }

    const startIso = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endIso = new Date(new Date(startIso).getTime() + Number(durationMinutes) * 60 * 1000).toISOString();

    try {
      await apiFetch('/api/integrations/google-calendar/book', {
        method: 'POST',
        body: JSON.stringify({
          contactId,
          userId: userId || session?.user.id,
          title,
          startTime: startIso,
          endTime: endIso,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      setShowScheduleModal(false);
      setTitle('');
      setContactId('');
      setStartDate('');
      fetchData();
    } catch (err: any) {
      setConflictError(err.message || 'Schedule conflict detected');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Google Calendar & Scheduling</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
              OAuth Sync Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Read employee busy times, prevent calendar overlaps, and coordinate appointments in UTC with local timezone rendering.
          </p>
        </div>
        <button
          onClick={() => {
            setShowScheduleModal(true);
            setConflictError('');
          }}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Book Appointment</span>
        </button>
      </div>

      {/* Appointments Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <span className="text-xs font-bold text-slate-900">Scheduled Client Appointments ({appointments.length})</span>
          <span className="text-[11px] text-slate-500">All times rendered in your browser's local timezone</span>
        </div>

        <div className="divide-y divide-slate-100">
          {appointments.map((a) => {
            const contact = contacts.find((c) => c.id === a.contactId);
            const employee = teamMembers.find((m) => m.userId === a.userId);
            const start = new Date(a.startTime);
            const end = new Date(a.endTime);

            return (
              <div key={a.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-slate-900 text-sm">{a.title}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200 uppercase">
                      {a.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Client: <span className="font-semibold text-slate-900">{contact?.name || 'Customer'}</span> • Host: <span className="font-semibold text-slate-900">{employee?.fullName || 'Assigned Agent'}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 flex items-center space-x-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {start.toLocaleDateString()} from {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}

          {appointments.length === 0 && (
            <div className="p-12 text-center text-slate-500 text-xs">
              No appointments currently scheduled.
            </div>
          )}
        </div>
      </div>

      {/* Book Appointment Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 text-xs shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Schedule Appointment</h3>
            <p className="text-slate-500 mt-1">Automatic conflict detection checks host busy times.</p>

            {conflictError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{conflictError}</span>
              </div>
            )}

            <form onSubmit={handleBookAppointment} className="mt-4 space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Appointment Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Scope Discovery Consultation"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Client Contact *</label>
                <select
                  required
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                >
                  <option value="">Select client...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Host Employee</label>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                >
                  <option value="">Myself ({session?.user.fullName})</option>
                  {teamMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.fullName} ({m.availability})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Start Time *</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Duration</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                >
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-xs"
                >
                  Schedule with Google Calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
