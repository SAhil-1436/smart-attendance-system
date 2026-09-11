import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  X, 
  UserPlus, 
  Save, 
  AlertCircle, 
  Loader2, 
  Hash, 
  User, 
  Mail, 
  Phone, 
  Building2, 
  BookOpen, 
  Layers, 
  CheckCircle2 
} from 'lucide-react';
import Button from './ui/Button';

export default function StudentModal({ isOpen, onClose, onSaved, studentToEdit }) {
  const isEditing = !!studentToEdit;
  
  const [formData, setFormData] = useState({
    student_id: '',
    name: '',
    email: '',
    phone: '',
    department_id: '',
    course_id: '',
    semester: 5,
    section: 'A',
    is_active: true
  });

  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAcademicOptions() {
      try {
        const [deptRes, courseRes] = await Promise.all([
          api.get('/academic/departments'),
          api.get('/academic/courses')
        ]);
        setDepartments(deptRes.data);
        setCourses(courseRes.data);
      } catch (err) {
        console.error('Failed to load academic options', err);
      }
    }
    if (isOpen) {
      fetchAcademicOptions();
    }
  }, [isOpen]);

  useEffect(() => {
    if (studentToEdit) {
      setFormData({
        student_id: studentToEdit.student_id,
        name: studentToEdit.name,
        email: studentToEdit.email,
        phone: studentToEdit.phone || '',
        department_id: studentToEdit.department_id,
        course_id: studentToEdit.course_id,
        semester: studentToEdit.semester,
        section: studentToEdit.section,
        is_active: studentToEdit.is_active
      });
    } else {
      setFormData({
        student_id: '',
        name: '',
        email: '',
        phone: '',
        department_id: departments[0]?.id || '',
        course_id: '',
        semester: 1,
        section: 'A',
        is_active: true
      });
    }
    setError(null);
  }, [studentToEdit, isOpen, departments]);

  useEffect(() => {
    if (formData.department_id) {
      const filtered = courses.filter(c => c.department_id === Number(formData.department_id));
      setFilteredCourses(filtered);
      if (!isEditing && filtered.length > 0 && !filtered.find(c => c.id === Number(formData.course_id))) {
        setFormData(prev => ({ ...prev, course_id: filtered[0].id }));
      }
    } else {
      setFilteredCourses([]);
    }
  }, [formData.department_id, courses, isEditing]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditing) {
        await api.put(`/students/${studentToEdit.id}`, {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          department_id: Number(formData.department_id),
          course_id: Number(formData.course_id),
          semester: Number(formData.semester),
          section: formData.section.toUpperCase(),
          is_active: formData.is_active
        });
      } else {
        await api.post('/students', {
          student_id: formData.student_id.trim(),
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          department_id: Number(formData.department_id),
          course_id: Number(formData.course_id),
          semester: Number(formData.semester),
          section: formData.section.toUpperCase()
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save student.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900/95 border border-slate-800/90 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto flex flex-col">
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/80 transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/5 shrink-0">
            {isEditing ? <Save className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {isEditing ? 'Edit Student Details' : 'Register New Student'}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {isEditing ? 'UPDATE' : 'ENROLL'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure personal identity & academic batch assignments
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center gap-3 text-xs text-red-400 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-indigo-400" />
                Student ID / Roll No <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isEditing}
                value={formData.student_id}
                onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                placeholder="e.g. 2304220100150"
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                Full Legal Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Ananya Rao"
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                Email Address <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="ananya@college.edu"
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-indigo-400" />
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91-9876543210"
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                Department <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
              >
                <option value="" className="bg-slate-900">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900">{d.name} ({d.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                Course / Program <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={formData.course_id}
                onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
              >
                <option value="" className="bg-slate-900">Select Course</option>
                {filteredCourses.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Semester <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="12"
                required
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Section / Batch <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                maxLength="5"
                required
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                placeholder="A"
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white uppercase focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition font-mono"
              />
            </div>
          </div>

          {isEditing && (
            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">Enrollment Status</div>
                <div className="text-[11px] text-slate-400">Allow student to attend and mark attendance</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-800 mt-6">
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
              loading={loading}
              icon={isEditing ? Save : UserPlus}
            >
              {isEditing ? 'Save Changes' : 'Register Student'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

