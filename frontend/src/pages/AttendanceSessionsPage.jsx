import React, { useState, useEffect } from 'react';
import { 
  CalendarCheck, 
  Plus, 
  Play, 
  Square, 
  Camera, 
  FileSpreadsheet, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Filter, 
  Search,
  Users,
  RefreshCw,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import CreateSessionModal from '../components/CreateSessionModal';
import LiveAttendanceKioskModal from '../components/LiveAttendanceKioskModal';
import SessionRecordsModal from '../components/SessionRecordsModal';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

export default function AttendanceSessionsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  
  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [kioskSession, setKioskSession] = useState(null);
  const [recordsSession, setRecordsSession] = useState(null);

  useEffect(() => {
    fetchSessions();
  }, [statusFilter, dateFilter]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      let url = '/sessions';
      const params = [];
      if (statusFilter) params.push(`status=${statusFilter}`);
      if (dateFilter) params.push(`date=${dateFilter}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await api.get(url);
      setSessions(res.data);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStopSession = async (sessionId) => {
    if (!confirm("Are you sure you want to stop and complete this attendance session?")) return;
    try {
      await api.patch(`/sessions/${sessionId}/stop`);
      fetchSessions();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to stop session.");
    }
  };

  const handleStartSession = async (sessionId) => {
    try {
      await api.patch(`/sessions/${sessionId}/start`);
      fetchSessions();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to activate session.");
    }
  };

  const handleResetFilters = () => {
    setStatusFilter('');
    setDateFilter('');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-indigo-950/40 p-5 rounded-3xl border border-slate-800/80 backdrop-blur-xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <CalendarCheck className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-white tracking-tight">Attendance Sessions</h2>
            <Badge variant="glow" className="text-[10px]">Live Kiosk</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Create lecture sessions, launch the biometric anti-spoofing kiosk & monitor check-in rolls
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          variant="primary"
          size="sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create New Session</span>
        </Button>
      </div>

      {/* Filter Controls Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>Filters:</span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="COMPLETED">Completed Only</option>
            </select>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20"
            />

            {(statusFilter || dateFilter) && (
              <Button
                onClick={handleResetFilters}
                variant="ghost"
                size="sm"
                className="text-xs text-slate-400 hover:text-white"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            )}
          </div>

          <Button
            onClick={fetchSessions}
            variant="secondary"
            size="sm"
            title="Refresh Sessions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </Card>

      {/* Sessions Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-3xl" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No Attendance Sessions Found"
          description="Click 'Create New Session' above to schedule attendance for your lecture."
          actionText="Create First Session"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sessions.map((sess) => {
            const isActive = sess.status === 'ACTIVE';
            return (
              <Card
                key={sess.id}
                glow={isActive}
                className={`p-5 flex flex-col justify-between ${
                  isActive ? 'border-indigo-500/40' : 'border-slate-800/80'
                }`}
              >
                <div>
                  {/* Card Header Status & Time */}
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant={isActive ? 'success' : 'secondary'}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1 ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                      {sess.status}
                    </Badge>

                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{sess.session_date}</span>
                    </div>
                  </div>

                  {/* Subject Name & Details */}
                  <h3 className="font-bold text-white text-base leading-snug tracking-tight">
                    {sess.subject_name}
                  </h3>
                  <p className="text-xs text-indigo-300/90 font-mono mt-0.5">
                    {sess.subject_code} &bull; Sem {sess.semester}-{sess.section}
                  </p>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400 space-y-1">
                    <p className="truncate">Course: <span className="text-slate-200 font-medium">{sess.course_name}</span></p>
                    <p className="truncate">Faculty: <span className="text-slate-200 font-medium">{sess.faculty_name}</span></p>
                    <p className="font-mono text-[11px] text-slate-500">Code: {sess.session_code}</p>
                  </div>

                  {/* Attendance Roll Mini Pill Stats */}
                  <div className="grid grid-cols-3 gap-1.5 my-4 p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">Total</span>
                      <p className="text-sm font-bold text-white mt-0.5">{sess.total_marked || 0}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-emerald-400 uppercase font-semibold">Present</span>
                      <p className="text-sm font-bold text-emerald-400 mt-0.5">{sess.present_count || 0}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-amber-400 uppercase font-semibold">Late</span>
                      <p className="text-sm font-bold text-amber-400 mt-0.5">{sess.late_count || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <Button
                    onClick={() => setRecordsSession(sess)}
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>View Roll</span>
                  </Button>

                  <div className="flex items-center gap-1.5">
                    {isActive ? (
                      <>
                        <Button
                          onClick={() => setKioskSession(sess)}
                          variant="glow"
                          size="sm"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Launch Kiosk</span>
                        </Button>

                        <Button
                          onClick={() => handleStopSession(sess.id)}
                          variant="secondary"
                          size="iconSm"
                          title="Stop Session"
                          className="text-slate-400 hover:text-rose-400"
                        >
                          <Square className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleStartSession(sess.id)}
                        variant="secondary"
                        size="sm"
                      >
                        <Play className="w-3 h-3 text-emerald-400" />
                        <span>Re-open</span>
                      </Button>
                    )}
                  </div>
                </div>

              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {isCreateOpen && (
        <CreateSessionModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false);
            fetchSessions();
          }}
        />
      )}

      {kioskSession && (
        <LiveAttendanceKioskModal
          session={kioskSession}
          isOpen={!!kioskSession}
          onClose={() => setKioskSession(null)}
          onRecordMarked={fetchSessions}
        />
      )}

      {recordsSession && (
        <SessionRecordsModal
          session={recordsSession}
          isOpen={!!recordsSession}
          onClose={() => setRecordsSession(null)}
          onRecordUpdated={fetchSessions}
        />
      )}

    </div>
  );
}
