import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  GraduationCap, 
  UserPlus, 
  Search, 
  Building2, 
  Mail, 
  Phone, 
  Hash, 
  ShieldCheck, 
  Trash2, 
  Power, 
  Users, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  KeyRound
} from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import FacultyModal from '../components/FacultyModal';

export default function FacultyManagementPage() {
  const [facultyList, setFacultyList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchFaculty = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const [facRes, deptRes] = await Promise.all([
        api.get('/faculty'),
        api.get('/academic/departments')
      ]);
      setFacultyList(facRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      console.error('Failed to load faculty records', err);
      setActionError('Failed to load faculty records from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  const handleToggleStatus = async (faculty) => {
    try {
      const newStatus = !faculty.is_active;
      await api.patch(`/faculty/${faculty.id}/status?is_active=${newStatus}`);
      fetchFaculty();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleDeleteFaculty = async (faculty) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${faculty.full_name} (${faculty.employee_id})? All associated login credentials will be revoked.`)) {
      return;
    }
    try {
      await api.delete(`/faculty/${faculty.id}`);
      fetchFaculty();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete faculty member.');
    }
  };

  const filteredFaculty = facultyList.filter(f => {
    const matchesSearch = 
      !search ||
      f.full_name.toLowerCase().includes(search.toLowerCase()) ||
      f.username.toLowerCase().includes(search.toLowerCase()) ||
      f.email.toLowerCase().includes(search.toLowerCase()) ||
      f.employee_id.toLowerCase().includes(search.toLowerCase());

    const matchesDept = !selectedDept || f.department_id === Number(selectedDept);
    return matchesSearch && matchesDept;
  });

  const totalActive = facultyList.filter(f => f.is_active).length;
  const uniqueDepts = new Set(facultyList.map(f => f.department_id).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800/80 p-6 rounded-3xl backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/5 shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Faculty & Teaching Staff
              </h2>
              <Badge variant="glow">
                {facultyList.length} REGISTERED
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Manage teacher login credentials, academic department assignments, and class scheduling permissions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="glow"
            icon={UserPlus}
          >
            Add New Teacher
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Faculty Staff"
          value={facultyList.length}
          subtitle="Registered college professors & lecturers"
          icon={Users}
          variant="indigo"
        />
        <StatCard
          title="Active Accounts"
          value={totalActive}
          subtitle="Authorized to schedule class sessions"
          icon={CheckCircle2}
          variant="emerald"
        />
        <StatCard
          title="Academic Departments"
          value={uniqueDepts}
          subtitle="Departments with assigned faculty"
          icon={Building2}
          variant="purple"
        />
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, username, email, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full sm:w-56 px-3.5 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
          >
            <option value="">All Academic Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchFaculty}
            icon={RefreshCw}
            className="shrink-0"
            title="Refresh List"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Faculty Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-3">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredFaculty.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No Faculty Members Found"
          description={search || selectedDept ? "No faculty members match your search filter criteria." : "No faculty members registered yet. Click 'Add New Teacher' to provision credentials."}
          actionText={search || selectedDept ? "Clear Filters" : "Add New Teacher"}
          onAction={() => {
            if (search || selectedDept) {
              setSearch('');
              setSelectedDept('');
            } else {
              setIsModalOpen(true);
            }
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredFaculty.map((f) => (
            <div
              key={f.id}
              className="p-6 rounded-3xl bg-slate-900/85 border border-slate-800/80 backdrop-blur-md shadow-xl hover:border-slate-700/80 transition duration-200 flex flex-col justify-between"
            >
              <div>
                {/* Top Avatar & Status */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-600/25 border border-white/10 shrink-0">
                      {f.full_name.charAt(f.full_name.startsWith('Dr.') ? 4 : 0) || f.full_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight leading-tight">
                        {f.full_name}
                      </h3>
                      <p className="text-xs text-indigo-400 font-medium mt-0.5">
                        {f.designation}
                      </p>
                    </div>
                  </div>

                  <Badge variant={f.is_active ? 'success' : 'destructive'} dot>
                    {f.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {/* Faculty Attributes */}
                <div className="space-y-2 py-3 px-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-indigo-400" /> Employee ID:
                    </span>
                    <span className="font-mono font-bold text-slate-200">{f.employee_id}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-400" /> Dept:
                    </span>
                    <span className="font-semibold text-slate-200 truncate max-w-[170px]">
                      {f.department_name || f.department_code || 'General'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800/60 pt-2">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> Username:
                    </span>
                    <span className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      {f.username}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-indigo-400" /> Email:
                    </span>
                    <span className="font-medium text-slate-300 truncate max-w-[170px]">
                      {f.email}
                    </span>
                  </div>

                  {f.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-indigo-400" /> Phone:
                      </span>
                      <span className="font-mono text-slate-300">{f.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Card Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800 gap-2">
                <Button
                  size="sm"
                  variant={f.is_active ? 'outline' : 'success'}
                  onClick={() => handleToggleStatus(f)}
                  className="text-[11px] h-8 flex-1"
                >
                  <Power className="w-3 h-3 mr-1" />
                  {f.is_active ? 'Deactivate' : 'Activate'}
                </Button>

                <button
                  onClick={() => handleDeleteFaculty(f)}
                  title="Delete Faculty Account"
                  className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition border border-transparent hover:border-red-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Faculty Registration Modal */}
      <FacultyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFacultySaved={() => {
          fetchFaculty();
        }}
      />
    </div>
  );
}
