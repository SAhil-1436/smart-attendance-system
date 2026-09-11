import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import StudentModal from '../components/StudentModal';
import StudentDetailsModal from '../components/StudentDetailsModal';
import FaceRegistrationModal from '../components/FaceRegistrationModal';
import { 
  Users, 
  Search, 
  UserPlus, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Edit3, 
  Trash2, 
  Eye, 
  Camera,
  ShieldCheck, 
  ShieldAlert, 
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

export default function StudentsList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [faceFilter, setFaceFilter] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [enrollingStudent, setEnrollingStudent] = useState(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        size: 15,
      };
      if (search.trim()) params.search = search.trim();
      if (semesterFilter) params.semester = Number(semesterFilter);
      if (sectionFilter) params.section = sectionFilter;
      if (faceFilter !== '') params.face_registered = faceFilter === 'true';

      const res = await api.get('/students', { params });
      setStudents(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to fetch students', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, semesterFilter, sectionFilter, faceFilter, page]);

  const handleDelete = async (student) => {
    if (!window.confirm(`WARNING: Permanently delete student ${student.name}? This will remove all associated face embeddings!`)) return;
    try {
      await api.delete(`/students/${student.id}?hard_delete=true`);
      fetchStudents();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete student');
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setSemesterFilter('');
    setSectionFilter('');
    setFaceFilter('');
    setPage(1);
  };

  const hasActiveFilters = search || semesterFilter || sectionFilter || faceFilter !== '';
  const totalPages = Math.ceil(total / 15) || 1;

  return (
    <div className="space-y-6">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-indigo-950/40 p-5 rounded-3xl border border-slate-800/80 backdrop-blur-xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Users className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-white tracking-tight">Student Directory</h2>
            <Badge variant="glow" className="text-[10px]">{total} Enrolled</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage academic profiles, course assignments & webcam face biometric enrollment
          </p>
        </div>

        {isAdmin && (
          <Button
            onClick={() => {
              setStudentToEdit(null);
              setIsModalOpen(true);
            }}
            variant="primary"
            size="sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add New Student</span>
          </Button>
        )}
      </div>

      {/* Search & Filter Controls */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            icon={Search}
            placeholder="Search by name, roll no, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />

          <div>
            <select
              value={semesterFilter}
              onChange={(e) => { setSemesterFilter(e.target.value); setPage(1); }}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={sectionFilter}
              onChange={(e) => { setSectionFilter(e.target.value); setPage(1); }}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Sections</option>
              {['A', 'B', 'C', 'D'].map(sec => (
                <option key={sec} value={sec}>Section {sec}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={faceFilter}
              onChange={(e) => { setFaceFilter(e.target.value); setPage(1); }}
              className="flex-1 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Biometric Status: All</option>
              <option value="true">Enrolled Faces</option>
              <option value="false">Pending Registration</option>
            </select>

            {hasActiveFilters && (
              <Button
                onClick={handleResetFilters}
                variant="ghost"
                size="icon"
                title="Reset Filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Desktop Data Table */}
      <div className="hidden md:block">
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Roll Number</th>
                  <th className="py-3.5 px-4">Department & Course</th>
                  <th className="py-3.5 px-4">Class</th>
                  <th className="py-3.5 px-4">Face Biometrics</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-medium">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800" />
                          <div className="space-y-1.5">
                            <div className="h-3.5 w-28 bg-slate-800 rounded" />
                            <div className="h-2.5 w-36 bg-slate-800/60 rounded" />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4"><div className="h-3 w-20 bg-slate-800 rounded font-mono" /></td>
                      <td className="py-3.5 px-4"><div className="h-3 w-24 bg-slate-800 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-3 w-16 bg-slate-800 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-5 w-24 bg-slate-800 rounded-lg" /></td>
                      <td className="py-3.5 px-4"><div className="h-3 w-14 bg-slate-800 rounded" /></td>
                      <td className="py-3.5 px-4 text-right"><div className="h-6 w-16 bg-slate-800 rounded ml-auto" /></td>
                    </tr>
                  ))
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-500">
                      <EmptyState
                        icon={Users}
                        title="No students found"
                        description="Try modifying your search query or filter selection."
                        actionText={hasActiveFilters ? "Clear All Filters" : undefined}
                        onAction={hasActiveFilters ? handleResetFilters : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-400 flex-shrink-0">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-white">{student.name}</div>
                            <div className="text-[11px] text-slate-400">{student.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-300">
                        {student.student_id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{student.course_code || 'BTECH_CSE'}</div>
                        <div className="text-[10px] text-slate-400">{student.department_name}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-300">
                        Sem {student.semester}-{student.section}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setEnrollingStudent(student)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition border ${
                            student.face_registered 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' 
                              : 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-600/30'
                          }`}
                        >
                          <Camera className="w-3 h-3" />
                          {student.face_registered ? 'Enrolled (Re-scan)' : 'Enroll Face'}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={student.is_active ? 'success' : 'destructive'}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1 ${student.is_active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {student.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            onClick={() => setSelectedStudent(student)}
                            variant="ghost"
                            size="iconSm"
                            title="View Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          {isAdmin && (
                            <>
                              <Button
                                onClick={() => {
                                  setStudentToEdit(student);
                                  setIsModalOpen(true);
                                }}
                                variant="ghost"
                                size="iconSm"
                                title="Edit Student"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                onClick={() => handleDelete(student)}
                                variant="ghost"
                                size="iconSm"
                                className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                                title="Delete Student"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile Responsive Cards (visible on phones & tablets) */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))
        ) : students.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students found"
            description="Try modifying your search filters."
          />
        ) : (
          students.map((student) => (
            <Card key={student.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-400">
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm leading-tight">{student.name}</h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{student.student_id}</p>
                  </div>
                </div>
                <Badge variant={student.is_active ? 'success' : 'destructive'}>
                  {student.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-800/80">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Course</span>
                  <p className="font-medium text-slate-200 truncate">{student.course_code || 'BTECH_CSE'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Semester</span>
                  <p className="font-medium text-slate-200">Sem {student.semester}-{student.section}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setEnrollingStudent(student)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                    student.face_registered 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                      : 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {student.face_registered ? 'Enrolled' : 'Enroll Face'}
                </button>

                <div className="flex items-center gap-1">
                  <Button onClick={() => setSelectedStudent(student)} variant="secondary" size="sm">
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    <span>View</span>
                  </Button>
                  {isAdmin && (
                    <Button onClick={() => handleDelete(student)} variant="ghost" size="iconSm" className="text-rose-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Pagination Footer */}
      {total > 15 && (
        <div className="flex items-center justify-between px-2 pt-2 text-xs text-slate-400">
          <div>
            Showing <span className="font-bold text-white">{(page - 1) * 15 + 1}</span> to{' '}
            <span className="font-bold text-white">{Math.min(page * 15, total)}</span> of{' '}
            <span className="font-bold text-white">{total}</span> students
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              variant="secondary"
              size="sm"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </Button>
            <span className="font-mono text-slate-300">
              Page {page} of {totalPages}
            </span>
            <Button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              variant="secondary"
              size="sm"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      {isModalOpen && (
        <StudentModal
          isOpen={isModalOpen}
          student={studentToEdit}
          onClose={() => {
            setIsModalOpen(false);
            setStudentToEdit(null);
          }}
          onSaved={() => {
            setIsModalOpen(false);
            setStudentToEdit(null);
            fetchStudents();
          }}
        />
      )}

      {selectedStudent && (
        <StudentDetailsModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onEnrollFace={(student) => {
            setSelectedStudent(null);
            setEnrollingStudent(student);
          }}
        />
      )}

      {enrollingStudent && (
        <FaceRegistrationModal
          isOpen={true}
          student={enrollingStudent}
          onClose={() => setEnrollingStudent(null)}
          onEnrolled={() => {
            setEnrollingStudent(null);
            fetchStudents();
          }}
        />
      )}

    </div>
  );
}
