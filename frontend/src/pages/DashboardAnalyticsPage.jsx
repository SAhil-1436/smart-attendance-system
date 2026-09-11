import React, { useState, useEffect } from 'react';
import { 
  Users, 
  CalendarCheck, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  ShieldCheck, 
  RefreshCw, 
  Sparkles,
  ArrowUpRight,
  Activity,
  ScanFace,
  Eye,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import api from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

export default function DashboardAnalyticsPage({ onNavigateToSessions, onNavigateToStudents }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchDashboardData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await api.get('/dashboard/summary');
      setData(res.data);
    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Auto-refresh interval (every 15s if enabled)
  useEffect(() => {
    let interval = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchDashboardData();
      }, 15000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const kpis = data?.kpis;
  const trends = data?.daily_trends || [];
  const deptAtt = data?.department_attendance || [];
  const statusDist = data?.status_distribution || [];
  const recent = data?.recent_activity || [];
  const lowAlerts = data?.low_attendance_alerts || [];

  // Chart Colors
  const STATUS_COLORS = {
    PRESENT: '#10b981',
    LATE: '#f59e0b',
    ABSENT: '#f43f5e',
    EXCUSED: '#6366f1'
  };

  const pieData = statusDist.map(item => ({
    name: item.status,
    value: item.count,
    color: STATUS_COLORS[item.status] || '#6366f1'
  }));

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-indigo-950/40 p-5 rounded-3xl border border-slate-800/80 backdrop-blur-xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-white tracking-tight">Executive Dashboard</h2>
            <Badge variant="glow" className="text-[10px]">Live</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time biometric attendance metrics, 7-day volume patterns & deficit alerts
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-2 ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-white'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
            Auto-Sync (15s)
          </button>

          <Button
            onClick={() => fetchDashboardData(true)}
            variant="secondary"
            size="sm"
            loading={refreshing}
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* 4 Core KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={kpis?.total_students || 0}
          subtitle={`${kpis?.face_registration_rate || 0}% Face Enrolled`}
          icon={Users}
          variant="indigo"
          trend="+12%"
          trendPositive={true}
        />

        <StatCard
          title="Today's Attendance"
          value={`${kpis?.today_attendance_rate || 0}%`}
          subtitle={`${kpis?.present_today || 0} Present • ${kpis?.late_today || 0} Late`}
          icon={TrendingUp}
          variant="emerald"
          trend="+4.2%"
          trendPositive={true}
        />

        <StatCard
          title="Active Sessions"
          value={kpis?.active_sessions_count || 0}
          subtitle="Lecture Kiosks Online Now"
          icon={CalendarCheck}
          variant="purple"
        />

        <StatCard
          title="Attendance Warnings"
          value={kpis?.low_attendance_warnings_count || 0}
          subtitle="Students Below 75% Cutoff"
          icon={AlertTriangle}
          variant="amber"
          trend="-2"
          trendPositive={true}
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: 7-Day Attendance Volume Trend */}
        <Card className="lg:col-span-2 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle>Attendance Volume Trend</CardTitle>
              <CardDescription>Daily count of Present vs Late markings over the past 7 days</CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present
              </span>
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            {trends.length === 0 ? (
              <EmptyState title="No trend data" description="No attendance sessions recorded in the last 7 days." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="day_name" 
                    stroke="#64748b" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    allowDecimals={false} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderColor: '#334155', 
                      borderRadius: '12px',
                      fontSize: '12px' 
                    }}
                    labelStyle={{ color: '#f8fafc', fontWeight: 600 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="present_count" 
                    name="Present" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#presentGrad)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="late_count" 
                    name="Late" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#lateGrad)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Right 1 Col: Status Distribution Donut */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="mb-2">
            <CardTitle>Attendance Distribution</CardTitle>
            <CardDescription>Overall breakdown by status</CardDescription>
          </div>

          <div className="h-48 w-full flex items-center justify-center relative">
            {pieData.length === 0 ? (
              <EmptyState title="No records" description="No attendance marked yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderColor: '#334155', 
                      borderRadius: '12px',
                      fontSize: '12px' 
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800">
            {statusDist.map((item) => (
              <div key={item.status} className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: STATUS_COLORS[item.status] || '#6366f1' }}
                  />
                  <span className="text-[10px] font-semibold uppercase text-slate-400">{item.status}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-sm font-bold text-white">{item.count}</span>
                  <span className="text-[10px] font-mono text-slate-400">{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Secondary Row: Department Comparison & Recent Live Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Department Attendance Performance */}
        <Card className="lg:col-span-1 p-5">
          <div className="mb-4">
            <CardTitle>Academic Departments</CardTitle>
            <CardDescription>Attendance compliance across courses</CardDescription>
          </div>

          <div className="h-56 w-full">
            {deptAtt.length === 0 ? (
              <EmptyState title="No department data" description="No department statistics available." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptAtt} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={10} unit="%" />
                  <YAxis type="category" dataKey="department_name" stroke="#cbd5e1" fontSize={11} width={80} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderColor: '#334155', 
                      borderRadius: '12px',
                      fontSize: '12px' 
                    }}
                    formatter={(val) => [`${val}%`, 'Attendance Rate']}
                  />
                  <Bar dataKey="attendance_rate" fill="#6366f1" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Live Attendance Activity Feed */}
        <Card className="lg:col-span-2 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Live Attendance Roll
              </CardTitle>
              <CardDescription>Real-time biometric check-in stream</CardDescription>
            </div>
            <Button onClick={onNavigateToSessions} variant="ghost" size="sm">
              <span>View Sessions</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-56 pr-1">
            {recent.length === 0 ? (
              <EmptyState 
                icon={Clock}
                title="No attendance events recorded yet"
                description="Launch an active session kiosk to start marking student check-ins."
              />
            ) : (
              recent.map((rec) => (
                <div
                  key={rec.id}
                  className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between hover:border-slate-700/80 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-xs">
                      {rec.student_name ? rec.student_name.charAt(0) : 'S'}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{rec.student_name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {rec.roll_number} • {rec.subject_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge variant={rec.status === 'PRESENT' ? 'success' : 'warning'}>
                        {rec.status}
                      </Badge>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                        {new Date(rec.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Bottom Alert Table: Low Attendance Students (< 75%) */}
      {lowAlerts.length > 0 && (
        <Card className="p-5 border-amber-500/30 bg-amber-950/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-amber-300">Attendance Deficit Alert (Below 75%)</CardTitle>
                <CardDescription>Students requiring immediate academic warning notice</CardDescription>
              </div>
            </div>
            <Badge variant="warning">{lowAlerts.length} Students At Risk</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 pb-2">
                <tr>
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">Roll Number</th>
                  <th className="py-2.5 px-3">Course</th>
                  <th className="py-2.5 px-3">Attendance Rate</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {lowAlerts.map((st) => (
                  <tr key={st.student_id} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 font-semibold text-white">{st.student_name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{st.roll_number}</td>
                    <td className="py-2.5 px-3 text-slate-400">{st.course_name}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-amber-500 h-1.5 rounded-full" 
                            style={{ width: `${Math.min(st.attendance_percentage, 100)}%` }} 
                          />
                        </div>
                        <span className="font-bold text-amber-400 font-mono">{st.attendance_percentage}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Badge variant="warning">Critical</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </div>
  );
}
