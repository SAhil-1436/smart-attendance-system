import React from 'react';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  BookOpen, 
  Layers, 
  ShieldCheck, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  Fingerprint
} from 'lucide-react';
import Badge from './ui/Badge';
import Button from './ui/Button';

export default function StudentDetailsModal({ student, onClose }) {
  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900/95 border border-slate-800/90 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-slate-100 animate-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          aria-label="Close details"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Student Avatar & Identity */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-500 flex items-center justify-center text-xl font-bold text-white shadow-xl shadow-indigo-600/25 border border-white/10 shrink-0">
            {student.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">{student.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {student.student_id}
              </span>
              <Badge variant={student.is_active ? 'success' : 'destructive'} dot>
                {student.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Biometric Status Banner */}
        <div className={`p-4 rounded-2xl mb-5 border transition flex items-center justify-between ${
          student.face_registered
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${student.face_registered ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
              <Fingerprint className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">Face Recognition Vector</div>
              <div className="text-xs opacity-80 mt-0.5">
                {student.face_registered ? 'Biometric Vector Enrolled (128-d)' : 'Face Not Yet Registered'}
              </div>
            </div>
          </div>
          {student.face_registered ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-400" />
          )}
        </div>

        {/* Academic Details */}
        <div className="space-y-2.5 text-xs bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 mb-5">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
            <span className="text-slate-400 flex items-center gap-2"><Layers className="w-3.5 h-3.5 text-indigo-400" /> Department</span>
            <span className="font-semibold text-slate-200">{student.department_name || student.department_code}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
            <span className="text-slate-400 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-indigo-400" /> Course / Program</span>
            <span className="font-semibold text-slate-200">{student.course_name || student.course_code}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
            <span className="text-slate-400">Semester & Section</span>
            <span className="font-semibold text-slate-200 font-mono">Sem {student.semester} &bull; Section {student.section}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
            <span className="text-slate-400 flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-indigo-400" /> Email</span>
            <span className="font-semibold text-slate-200 truncate max-w-[200px]">{student.email}</span>
          </div>

          <div className="flex items-center justify-between py-1.5">
            <span className="text-slate-400 flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-indigo-400" /> Phone</span>
            <span className="font-semibold text-slate-200 font-mono">{student.phone || 'N/A'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-800">
          <span>Enrolled: {new Date(student.created_at).toLocaleDateString()}</span>
          <span>Updated: {new Date(student.updated_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

