import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  X, 
  GraduationCap, 
  UserPlus, 
  Save, 
  AlertCircle, 
  Hash, 
  User, 
  Mail, 
  Phone, 
  Building2, 
  Briefcase, 
  KeyRound, 
  CheckCircle2, 
  Copy, 
  Check, 
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';

export default function FacultyModal({ isOpen, onClose, onFacultySaved }) {
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    department_id: '',
    employee_id: '',
    phone: '',
    designation: 'Assistant Professor'
  });

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchDepartments() {
      try {
        const res = await api.get('/academic/departments');
        setDepartments(res.data);
        if (res.data.length > 0 && !formData.department_id) {
          setFormData(prev => ({ ...prev, department_id: res.data[0].id }));
        }
      } catch (err) {
        console.error('Failed to load academic departments', err);
      }
    }
    if (isOpen) {
      fetchDepartments();
      setError(null);
      setCreatedCredentials(null);
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = 'Fac@';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password: pwd }));
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = `College Attendance Portal Login Credentials:\nUsername: ${createdCredentials.username}\nPassword: ${createdCredentials.password}\nPortal: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.department_id) {
      setError('Please select a department for the faculty member.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        full_name: formData.full_name.trim(),
        username: formData.username.trim().toLowerCase(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        department_id: Number(formData.department_id),
        employee_id: formData.employee_id.trim().toUpperCase(),
        phone: formData.phone.trim() || null,
        designation: formData.designation.trim() || 'Assistant Professor'
      };

      const res = await api.post('/faculty', payload);

      setCreatedCredentials({
        name: res.data.full_name,
        username: res.data.username,
        password: formData.password,
        department: res.data.department_name || res.data.department_code,
        employee_id: res.data.employee_id
      });

      if (onFacultySaved) onFacultySaved(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create faculty member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900/95 border border-slate-800/90 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto flex flex-col animate-in zoom-in-95 duration-200">
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
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Register New Teacher / Faculty
              </h2>
              <Badge variant="glow">
                ADMIN ACCESS
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Provision faculty credentials and assign academic department
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center gap-3 text-xs text-red-400 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Success Slip Display */}
        {createdCredentials ? (
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-white">Faculty Account Created Successfully!</h3>
                  <p className="text-xs text-emerald-400/90">
                    The teacher can now log in using these credentials to schedule classes and conduct attendance.
                  </p>
                </div>
              </div>
            </div>

            {/* Credential Slip Card */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 relative space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Teacher Login Slip
                </span>
                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  {createdCredentials.employee_id}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Faculty Name:</span>
                  <span className="font-bold text-white">{createdCredentials.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Department:</span>
                  <span className="font-medium text-slate-200">{createdCredentials.department}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 font-mono">Username:</span>
                  <span className="font-mono font-bold text-indigo-400">{createdCredentials.username}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 font-mono">Password:</span>
                  <span className="font-mono font-bold text-emerald-400">{createdCredentials.password}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCredentials}
                  icon={copied ? Check : Copy}
                  className="w-full text-xs"
                >
                  {copied ? 'Credentials Copied!' : 'Copy Credentials to Clipboard'}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="glow"
                size="sm"
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  Full Name (with Title) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. Dr. Priya Verma"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-indigo-400" />
                  Employee ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  placeholder="e.g. FAC-1002"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 uppercase focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  Login Username <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                  placeholder="e.g. dr.priya"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition font-mono"
                />
              </div>

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
                  placeholder="priya@college.edu"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition"
                />
              </div>
            </div>

            {/* Password Field with Generator */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                  Initial Password <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={generateStrongPassword}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
                >
                  <Sparkles className="w-3 h-3" />
                  Generate Strong Password
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  Department Assignment <span className="text-red-400">*</span>
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
                  <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                  Designation / Role
                </label>
                <select
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
                >
                  <option value="Assistant Professor" className="bg-slate-900">Assistant Professor</option>
                  <option value="Associate Professor" className="bg-slate-900">Associate Professor</option>
                  <option value="Professor" className="bg-slate-900">Professor</option>
                  <option value="Head of Department (HOD)" className="bg-slate-900">Head of Department (HOD)</option>
                  <option value="Visiting Lecturer" className="bg-slate-900">Visiting Lecturer</option>
                  <option value="Lab Instructor" className="bg-slate-900">Lab Instructor</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-indigo-400" />
                Phone Contact Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91-9876543210"
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition"
              />
            </div>

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
                icon={UserPlus}
              >
                Register Teacher
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
