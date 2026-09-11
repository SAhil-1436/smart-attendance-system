import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  BookOpen, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  PlusCircle,
  Hash
} from 'lucide-react';
import api from '../services/api';
import Button from './ui/Button';

export default function CreateSessionModal({ isOpen, onClose, onSessionCreated }) {
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    course_id: '',
    subject_id: '',
    semester: 5,
    section: 'A',
    session_date: new Date().toISOString().split('T')[0],
    start_time: new Date().toTimeString().split(' ')[0].substring(0, 5)
  });

  useEffect(() => {
    if (isOpen) {
      fetchCourses();
      setError(null);
    }
  }, [isOpen]);

  const fetchCourses = async () => {
    try {
      const res = await api.get('/academic/courses');
      setCourses(res.data);
      if (res.data.length > 0) {
        const firstCourse = res.data[0];
        setFormData(prev => ({ ...prev, course_id: firstCourse.id }));
        fetchSubjects(firstCourse.id, formData.semester);
      }
    } catch (err) {
      console.error("Failed to load courses:", err);
    }
  };

  const fetchSubjects = async (courseId, semester) => {
    try {
      const res = await api.get(`/academic/subjects?course_id=${courseId}&semester=${semester}`);
      setSubjects(res.data);
      if (res.data.length > 0) {
        setFormData(prev => ({ ...prev, subject_id: res.data[0].id }));
      } else {
        setFormData(prev => ({ ...prev, subject_id: '' }));
      }
    } catch (err) {
      console.error("Failed to load subjects:", err);
    }
  };

  const handleCourseChange = (e) => {
    const cid = parseInt(e.target.value);
    setFormData(prev => ({ ...prev, course_id: cid }));
    fetchSubjects(cid, formData.semester);
  };

  const handleSemesterChange = (e) => {
    const sem = parseInt(e.target.value);
    setFormData(prev => ({ ...prev, semester: sem }));
    if (formData.course_id) {
      fetchSubjects(formData.course_id, sem);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject_id) {
      setError("Please select a valid subject for the chosen semester.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        subject_id: parseInt(formData.subject_id),
        course_id: parseInt(formData.course_id),
        semester: parseInt(formData.semester),
        section: formData.section.toUpperCase(),
        session_date: formData.session_date,
        start_time: formData.start_time.length === 5 ? `${formData.start_time}:00` : formData.start_time
      };

      const res = await api.post('/sessions', payload);
      onSessionCreated(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create attendance session.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900/95 border border-slate-800/90 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 flex items-center justify-center shadow-lg shadow-indigo-500/5 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Create Attendance Session</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  NEW LECTURE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Initialize lecture session for attendance marking</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                Course / Program <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.course_id}
                onChange={handleCourseChange}
                className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
                required
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900">{c.name} ({c.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Semester <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.semester}
                onChange={handleSemesterChange}
                className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <option key={s} value={s} className="bg-slate-900">Semester {s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              Subject / Topic <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.subject_id}
              onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
              required
            >
              {subjects.length === 0 ? (
                <option value="" className="bg-slate-900">No subjects registered for this semester</option>
              ) : (
                subjects.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-900">{s.name} ({s.code})</option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Section / Batch <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value.toUpperCase() })}
                maxLength={5}
                className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white uppercase focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-indigo-400" />
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={formData.session_date}
                onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-indigo-400" />
                Start Time <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
                required
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-5 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="glow"
              size="sm"
              disabled={subjects.length === 0}
              loading={loading}
              icon={PlusCircle}
            >
              Create & Start Session
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
}

