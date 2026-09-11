import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  Edit3, 
  Save, 
  UserCheck, 
  UserX,
  Search,
  Users
} from 'lucide-react';
import api from '../services/api';
import Badge from './ui/Badge';
import Button from './ui/Button';

export default function SessionRecordsModal({ session, isOpen, onClose, onRecordsUpdated }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Manual override state
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [overrideStatus, setOverrideStatus] = useState('PRESENT');
  const [overrideRemarks, setOverrideRemarks] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideError, setOverrideError] = useState(null);

  useEffect(() => {
    if (isOpen && session) {
      fetchRecords();
      setSelectedRecord(null);
      setOverrideError(null);
    }
  }, [isOpen, session]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/sessions/${session.id}/records`);
      setRecords(res.data);
    } catch (err) {
      console.error("Failed to fetch session records:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualOverride = async (e) => {
    e.preventDefault();
    if (!overrideRemarks.trim() || overrideRemarks.trim().length < 3) {
      setOverrideError("Remarks are mandatory (at least 3 characters).");
      return;
    }

    setSavingOverride(true);
    setOverrideError(null);

    try {
      await api.post('/attendance/manual-mark', {
        session_id: session.id,
        student_id: selectedRecord.student_id,
        status: overrideStatus,
        remarks: overrideRemarks
      });

      setSelectedRecord(null);
      setOverrideRemarks('');
      await fetchRecords();
      if (onRecordsUpdated) onRecordsUpdated();
    } catch (err) {
      setOverrideError(err.response?.data?.detail || "Failed to update attendance record.");
    } finally {
      setSavingOverride(false);
    }
  };

  const filteredRecords = records.filter(r => 
    (r.student_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.roll_number || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900/95 border border-slate-800/90 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 flex items-center justify-center shadow-lg shadow-indigo-500/5 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Session Attendance Roll
                </h2>
                <Badge variant={session.status === 'ACTIVE' ? 'glow' : 'outline'} dot={session.status === 'ACTIVE'}>
                  {session.status}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                {session.session_code} &bull; <span className="font-sans text-slate-300 font-medium">{session.subject_name}</span> &bull; Sem {session.semester}-{session.section} &bull; {session.session_date}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close roll modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats & Search Ribbon */}
        <div className="px-6 py-3.5 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Total Marked: <strong className="text-white font-mono">{records.length}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Present: <strong className="text-emerald-400 font-mono">{records.filter(r => r.status === 'PRESENT').length}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Late: <strong className="text-amber-400 font-mono">{records.filter(r => r.status === 'LATE').length}</strong></span>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student or roll..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 animate-pulse flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <span>Synchronizing session records...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              <Users className="w-10 h-10 mx-auto mb-2 text-slate-700" />
              <p className="text-slate-400 font-medium">No attendance records found</p>
              <p className="text-slate-500 mt-0.5">Students can mark attendance using the Live Kiosk</p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-inner bg-slate-950/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 min-w-[640px]">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Roll Number</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Method / Match</th>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                    {filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3.5 font-semibold text-white">
                          {r.student_name}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-400 text-[11px]">
                          {r.roll_number}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge 
                            variant={
                              r.status === 'PRESENT' ? 'success' :
                              r.status === 'LATE' ? 'warning' : 'default'
                            }
                          >
                            {r.status}
                          </Badge>
                          {r.remarks && (
                            <span className="block text-[10px] text-slate-500 italic mt-1 max-w-[200px] truncate">
                              "{r.remarks}"
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {r.verification_method === 'FACE_LIVENESS' ? (
                              <>
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[11px] font-mono text-slate-300">
                                  {r.confidence_score ? `${(r.confidence_score * 100).toFixed(1)}%` : 'Biometric'}
                                </span>
                              </>
                            ) : (
                              <span className="text-[11px] text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                Manual
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-400 text-[11px]">
                          {new Date(r.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedRecord(r);
                              setOverrideStatus(r.status);
                              setOverrideRemarks(r.remarks || '');
                              setOverrideError(null);
                            }}
                            icon={Edit3}
                            className="text-[11px] h-8 ml-auto"
                          >
                            Override
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Manual Override Editor Tray */}
          {selectedRecord && (
            <div className="p-5 rounded-2xl bg-slate-950 border border-indigo-500/40 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-xs font-bold text-white">
                    Manual Attendance Override: <span className="text-indigo-300 font-medium">{selectedRecord.student_name}</span>
                  </h4>
                </div>
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
              </div>

              {overrideError && (
                <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{overrideError}</span>
                </div>
              )}

              <form onSubmit={handleManualOverride} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Attendance Status</label>
                  <select
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="LATE">LATE</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="MANUALLY_MARKED">MANUALLY_MARKED</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    Faculty Remarks / Audit Reason <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g., Medical leave slip verified by professor..."
                      value={overrideRemarks}
                      onChange={(e) => setOverrideRemarks(e.target.value)}
                      className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition"
                      required
                    />
                    <Button
                      type="submit"
                      loading={savingOverride}
                      variant="glow"
                      size="sm"
                      icon={Save}
                      className="shrink-0"
                    >
                      Save Override
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

