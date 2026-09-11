import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  FileSpreadsheet, 
  FileCode, 
  Filter, 
  Calendar, 
  Search, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  RefreshCw,
  Eye,
  Layers,
  Sparkles,
  RotateCcw,
  TrendingUp
} from 'lucide-react';
import api from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

export default function AttendanceReportsPage() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);
  const [activeView, setActiveView] = useState('summary'); // 'summary' | 'detailed'

  // Academic option states
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Filter criteria
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    department_id: '',
    course_id: '',
    subject_id: '',
    semester: '',
    section: '',
    status: '',
    search_query: ''
  });

  useEffect(() => {
    fetchAcademicOptions();
    fetchReport();
  }, []);

  const fetchAcademicOptions = async () => {
    try {
      const [deptRes, courseRes] = await Promise.all([
        api.get('/academic/departments'),
        api.get('/academic/courses')
      ]);
      setDepartments(deptRes.data);
      setCourses(courseRes.data);
    } catch (err) {
      console.error("Failed to load academic options:", err);
    }
  };

  const handleCourseChange = async (courseId) => {
    setFilters(prev => ({ ...prev, course_id: courseId, subject_id: '' }));
    if (courseId) {
      try {
        const res = await api.get(`/academic/subjects?course_id=${courseId}`);
        setSubjects(res.data);
      } catch (err) {
        console.error("Failed to load subjects:", err);
      }
    } else {
      setSubjects([]);
    }
  };

  const buildQueryString = () => {
    const params = [];
    if (filters.start_date) params.push(`start_date=${filters.start_date}`);
    if (filters.end_date) params.push(`end_date=${filters.end_date}`);
    if (filters.department_id) params.push(`department_id=${filters.department_id}`);
    if (filters.course_id) params.push(`course_id=${filters.course_id}`);
    if (filters.subject_id) params.push(`subject_id=${filters.subject_id}`);
    if (filters.semester) params.push(`semester=${filters.semester}`);
    if (filters.section) params.push(`section=${filters.section.toUpperCase()}`);
    if (filters.status) params.push(`status=${filters.status}`);
    return params.length > 0 ? `?${params.join('&')}` : '';
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const query = buildQueryString();
      const res = await api.get(`/reports${query}`);
      setReportData(res.data);
    } catch (err) {
      console.error("Failed to fetch attendance report:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const query = buildQueryString();
      const res = await api.get(`/reports/export/${format}${query}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const ext = format === 'excel' ? 'xlsx' : format;
      const dateTag = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `attendance_report_${dateTag}.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert(`Failed to export ${format.toUpperCase()} report.`);
    } finally {
      setExporting(null);
    }
  };

  const handleResetFilters = () => {
    setFilters({
      start_date: '',
      end_date: '',
      department_id: '',
      course_id: '',
      subject_id: '',
      semester: '',
      section: '',
      status: '',
      search_query: ''
    });
    setSubjects([]);
  };

  // Filter client-side search query on summary or records
  const filteredSummaries = (reportData?.student_summaries || []).filter(s =>
    (s.student_name || '').toLowerCase().includes(filters.search_query.toLowerCase()) ||
    (s.roll_number || '').toLowerCase().includes(filters.search_query.toLowerCase())
  );

  const filteredRecords = (reportData?.records || []).filter(r =>
    (r.student_name || '').toLowerCase().includes(filters.search_query.toLowerCase()) ||
    (r.roll_number || '').toLowerCase().includes(filters.search_query.toLowerCase()) ||
    (r.subject_name || '').toLowerCase().includes(filters.search_query.toLowerCase())
  );

  const summary = reportData?.summary;

  return (
    <div className="space-y-6">
      
      {/* Header with Export Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-indigo-950/40 p-5 sm:p-6 rounded-3xl border border-slate-800/80 backdrop-blur-xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileText className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-white tracking-tight">
              Reports & Document Export Center
            </h2>
            <Badge variant="glow" className="text-[10px]">Institutional</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Multi-criteria academic attendance filtering, deficit rosters & publication-ready document exports
          </p>
        </div>

        {/* 1-Click Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            variant="destructive"
            size="sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting === 'pdf' ? 'Generating PDF...' : 'Export PDF'}</span>
          </Button>

          <Button
            onClick={() => handleExport('excel')}
            disabled={exporting !== null}
            variant="success"
            size="sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{exporting === 'excel' ? 'Building XLSX...' : 'Export Excel'}</span>
          </Button>

          <Button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
            variant="secondary"
            size="sm"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{exporting === 'csv' ? 'Exporting CSV...' : 'Export CSV'}</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Check-ins"
          value={summary?.total_records || 0}
          subtitle="Total Markings Recorded"
          icon={CheckCircle2}
          variant="indigo"
        />

        <StatCard
          title="Class Sessions"
          value={summary?.total_sessions_held || 0}
          subtitle="Lectures Held In Scope"
          icon={Calendar}
          variant="purple"
        />

        <StatCard
          title="Active Students"
          value={summary?.unique_students_count || 0}
          subtitle="Unique Students Scanned"
          icon={Users}
          variant="emerald"
        />

        <StatCard
          title="Class Average"
          value={`${summary?.class_average_attendance_rate || 0}%`}
          subtitle="Institutional Compliance"
          icon={TrendingUp}
          variant="amber"
          trend="+3.1%"
          trendPositive={true}
        />
      </div>

      {/* Multi-Criteria Query Filters Card */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Report Filter Criteria</span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleResetFilters} variant="ghost" size="sm">
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              <span>Reset</span>
            </Button>
            <Button onClick={fetchReport} variant="primary" size="sm" loading={loading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              <span>Apply Filters</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">From Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">To Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Department</label>
            <select
              value={filters.department_id}
              onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Course</label>
            <select
              value={filters.course_id}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Subject</label>
            <select
              value={filters.subject_id}
              onChange={(e) => setFilters({ ...filters, subject_id: e.target.value })}
              disabled={subjects.length === 0}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            >
              <option value="">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Semester</label>
            <select
              value={filters.semester}
              onChange={(e) => setFilters({ ...filters, semester: e.target.value })}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Section</label>
            <select
              value={filters.section}
              onChange={(e) => setFilters({ ...filters, section: e.target.value })}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Sections</option>
              {['A', 'B', 'C', 'D'].map(sec => (
                <option key={sec} value={sec}>Section {sec}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="ABSENT">Absent</option>
            </select>
          </div>
        </div>
      </Card>

      {/* View Switcher & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => setActiveView('summary')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeView === 'summary'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Student Summary Roster
          </button>
          <button
            onClick={() => setActiveView('detailed')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeView === 'detailed'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Detailed Transaction Logs
          </button>
        </div>

        <div className="w-full sm:w-72">
          <Input
            icon={Search}
            placeholder="Quick search student or roll..."
            value={filters.search_query}
            onChange={(e) => setFilters({ ...filters, search_query: e.target.value })}
          />
        </div>
      </div>

      {/* Tab 1: Student Attendance Summary Roster */}
      {activeView === 'summary' && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Roll Number</th>
                  <th className="py-3.5 px-4">Class</th>
                  <th className="py-3.5 px-4">Sessions Attended</th>
                  <th className="py-3.5 px-4">Late Count</th>
                  <th className="py-3.5 px-4">Attendance Rate</th>
                  <th className="py-3.5 px-4 text-right">Academic Standing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-medium">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-3.5 px-4"><div className="h-4 w-32 bg-slate-800 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-4 w-20 bg-slate-800 rounded font-mono" /></td>
                      <td className="py-3.5 px-4"><div className="h-4 w-16 bg-slate-800 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-4 w-14 bg-slate-800 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-4 w-10 bg-slate-800 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-4 w-24 bg-slate-800 rounded" /></td>
                      <td className="py-3.5 px-4 text-right"><div className="h-5 w-16 bg-slate-800 rounded ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredSummaries.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-500">
                      <EmptyState
                        icon={FileText}
                        title="No Attendance Summary Found"
                        description="Try adjusting your filter dates or selecting another department."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredSummaries.map((s) => (
                    <tr key={s.student_id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-bold text-white">{s.student_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{s.roll_number}</td>
                      <td className="py-3 px-4 text-slate-400">Sem {s.semester}-{s.section}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-emerald-400">{s.attended_sessions}</span>
                        <span className="text-slate-500 font-mono"> / {s.total_sessions}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-400">{s.late_count}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-1.5 rounded-full ${s.is_low_attendance ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(s.attendance_rate, 100)}%` }} 
                            />
                          </div>
                          <span className={`font-mono font-bold ${s.is_low_attendance ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {s.attendance_rate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {s.is_low_attendance ? (
                          <Badge variant="warning">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Warning (&lt;75%)
                          </Badge>
                        ) : (
                          <Badge variant="success">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Good Standing
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Detailed Individual Attendance Logs */}
      {activeView === 'detailed' && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Roll Number</th>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Method</th>
                  <th className="py-3.5 px-4">Time</th>
                  <th className="py-3.5 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-medium">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-3.5 px-4"><div className="h-4 w-32 bg-slate-800 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-4 w-20 bg-slate-800 rounded font-mono" /></td>
                      <td className="py-3.5 px-4"><div className="h-4 w-28 bg-slate-800 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-4 w-14 bg-slate-800 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-4 w-20 bg-slate-800 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-4 w-24 bg-slate-800 rounded" /></td>
                      <td className="py-3.5 px-4"><div className="h-4 w-16 bg-slate-800 rounded" /></td>
                    </tr>
                  ))
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-500">
                      <EmptyState
                        icon={Clock}
                        title="No Detailed Logs Found"
                        description="No attendance transaction records match current filters."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-bold text-white">{r.student_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{r.roll_number}</td>
                      <td className="py-3 px-4 text-slate-300 font-semibold">{r.subject_name}</td>
                      <td className="py-3 px-4">
                        <Badge variant={r.status === 'PRESENT' ? 'success' : r.status === 'LATE' ? 'warning' : 'destructive'}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {r.verification_method === 'FACE_RECOGNITION' ? (
                            <span className="text-indigo-400 font-semibold flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              AI Match ({(r.confidence_score * 100).toFixed(0)}%)
                            </span>
                          ) : (
                            <span className="text-slate-400">Manual Override</span>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {new Date(r.marked_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-3 px-4 text-slate-400 italic text-[11px]">
                        {r.remarks || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </div>
  );
}
