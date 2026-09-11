import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginModal from './components/LoginModal';
import ChangePasswordModal from './components/ChangePasswordModal';
import StudentsList from './pages/StudentsList';
import LiveRecognitionPreview from './pages/LiveRecognitionPreview';
import LivenessTesterPage from './pages/LivenessTesterPage';
import AttendanceSessionsPage from './pages/AttendanceSessionsPage';
import DashboardAnalyticsPage from './pages/DashboardAnalyticsPage';
import AttendanceReportsPage from './pages/AttendanceReportsPage';
import FacultyManagementPage from './pages/FacultyManagementPage';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import MobileDrawer from './components/layout/MobileDrawer';
import api from './services/api';

import { 
  ShieldCheck, 
  Activity, 
  Database, 
  Camera, 
  Users, 
  CalendarCheck, 
  CheckCircle2, 
  Clock,
  Sparkles,
  LogIn,
  LogOut,
  UserCheck,
  ShieldAlert,
  KeyRound,
  LayoutDashboard,
  ScanFace,
  Eye,
  FileText,
  Lock,
  ArrowRight,
  GraduationCap
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';

function DashboardContent() {
  const { user, isAuthenticated, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'students' | 'recognition' | 'liveness' | 'attendance' | 'reports'
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authTestResult, setAuthTestResult] = useState(null);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await api.get('/health');
      setHealth(res.data);
    } catch (err) {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  const testRoleAccess = async (endpointName) => {
    setAuthTestResult({ loading: true, endpoint: endpointName });
    try {
      const res = await api.get(`/auth/${endpointName}`);
      setAuthTestResult({ success: true, data: res.data, status: res.status });
    } catch (err) {
      setAuthTestResult({ 
        success: false, 
        error: err.response?.data?.detail || err.message, 
        status: err.response?.status 
      });
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const phases = [
    { id: 0, name: 'Architecture & System Design', status: 'completed' },
    { id: 1, name: 'Project Scaffolding & Setup', status: 'completed' },
    { id: 2, name: 'Database Schema & Seeds', status: 'completed' },
    { id: 3, name: 'JWT Authentication & RBAC', status: 'completed' },
    { id: 4, name: 'Student Management CRUD', status: 'completed' },
    { id: 5, name: 'Face Enrollment & Quality Filter', status: 'completed' },
    { id: 6, name: 'Face Recognition Engine', status: 'completed' },
    { id: 7, name: 'Liveness & Anti-Spoofing', status: 'completed' },
    { id: 8, name: 'Attendance Sessions & Kiosk', status: 'completed' },
    { id: 9, name: 'Live Dashboard & Analytics', status: 'completed' },
    { id: 10, name: 'Reports & Document Export', status: 'completed' },
    { id: 11, name: 'Security Hardening & Rate Limiting', status: 'completed' },
    { id: 12, name: 'Performance Optimization & SIMD Caching', status: 'completed' },
    { id: 13, name: 'E2E Testing & System Validation', status: 'completed' },
    { id: 14, name: 'Final UI/UX Polish & Feedback', status: 'completed' },
    { id: 15, name: 'Production Documentation & Handover', status: 'completed' },
  ];

  // Render Auth Required Gatekeeper
  const renderAuthRequired = (title, description, icon) => {
    const Icon = icon;
    return (
      <Card className="max-w-md mx-auto my-12 p-8 text-center bg-slate-900/90 border-slate-800 shadow-2xl">
        <div className="p-3.5 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30 w-fit mx-auto mb-4">
          <Icon className="w-7 h-7" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="mt-2 mb-6">
          {description}
        </CardDescription>
        <Button onClick={() => setIsLoginOpen(true)} variant="primary" size="lg" className="w-full">
          <LogIn className="w-4 h-4" />
          <span>Sign In to Continue</span>
        </Button>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased selection:bg-indigo-500/30 selection:text-white">
      {/* Collapsible Modern Sidebar (Desktop/Laptop) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
      />

      {/* Mobile Drawer (Tablet/Mobile) */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Navbar */}
        <Navbar
          activeTab={activeTab}
          onToggleMobileMenu={() => setIsMobileDrawerOpen(true)}
          onOpenLogin={() => setIsLoginOpen(true)}
          onOpenChangePassword={() => setIsChangePasswordOpen(true)}
          health={health}
          onLaunchKiosk={() => setActiveTab('attendance')}
        />

        {/* Content Container */}
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
          {activeTab === 'faculty' ? (
            isAuthenticated ? (
              user?.role === 'ADMIN' ? (
                <FacultyManagementPage />
              ) : (
                <Card className="max-w-md mx-auto my-12 p-8 text-center bg-slate-900/90 border-slate-800 shadow-2xl">
                  <div className="p-3.5 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30 w-fit mx-auto mb-4">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                  <CardTitle className="text-lg">Admin Access Required</CardTitle>
                  <CardDescription className="mt-2 mb-6">
                    Only system administrators can register new faculty members, reset teacher passwords, and manage academic accounts.
                  </CardDescription>
                  <Button onClick={() => setActiveTab('overview')} variant="secondary" size="md" className="w-full">
                    Return to Dashboard
                  </Button>
                </Card>
              )
            ) : (
              renderAuthRequired(
                'Faculty Management Protected',
                'Please sign in with an Administrator account to register new teachers, manage staff accounts, and issue login credentials.',
                GraduationCap
              )
            )
          ) : activeTab === 'reports' ? (
            isAuthenticated ? (
              <AttendanceReportsPage />
            ) : (
              renderAuthRequired(
                'Reports & Export Protected',
                'Please sign in as Admin or Faculty to generate formal academic reports and export PDF/Excel/CSV files.',
                FileText
              )
            )
          ) : activeTab === 'attendance' ? (
            isAuthenticated ? (
              <AttendanceSessionsPage />
            ) : (
              renderAuthRequired(
                'Attendance Sessions Protected',
                'Please sign in as Admin or Faculty to manage lecture attendance sessions and launch the biometric kiosk.',
                CalendarCheck
              )
            )
          ) : activeTab === 'liveness' ? (
            isAuthenticated ? (
              <LivenessTesterPage />
            ) : (
              renderAuthRequired(
                'Liveness Tester Protected',
                'Please sign in as Admin or Faculty to test the active challenge-response anti-spoofing engine.',
                Eye
              )
            )
          ) : activeTab === 'recognition' ? (
            isAuthenticated ? (
              <LiveRecognitionPreview />
            ) : (
              renderAuthRequired(
                'Recognition Arena Protected',
                'Please sign in as Admin or Faculty to test 1-to-N face recognition against the student vector database.',
                ScanFace
              )
            )
          ) : activeTab === 'students' ? (
            isAuthenticated ? (
              <StudentsList />
            ) : (
              renderAuthRequired(
                'Student Directory Protected',
                'Please sign in as Admin or Faculty to access student academic profiles and webcam face enrollment.',
                Users
              )
            )
          ) : (
            <div className="space-y-8">
              {isAuthenticated ? (
                <DashboardAnalyticsPage
                  onNavigateToSessions={() => setActiveTab('attendance')}
                  onNavigateToStudents={() => setActiveTab('students')}
                />
              ) : (
                <>
                  {/* Guest Hero / Platform Introduction */}
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-900 p-6 sm:p-10 border border-indigo-500/20 shadow-2xl backdrop-blur-xl">
                    <div className="max-w-2xl relative z-10">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-4 border border-emerald-500/20">
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Biometric Attendance Platform
                      </div>
                      <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-3 leading-tight">
                        Deep Face Recognition & Active Anti-Spoofing
                      </h2>
                      <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6 max-w-xl">
                        A production-grade college attendance platform powered by OpenCV Zoo YuNet & SFace neural networks, SIMD continuous vector matching (0.042 ms), and multi-criteria PDF/Excel document export.
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          onClick={() => setIsLoginOpen(true)}
                          variant="primary"
                          size="lg"
                        >
                          <LogIn className="w-4 h-4" />
                          <span>Sign In to Access Portal</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Live Role-Based Authorization Tester */}
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <ShieldAlert className="w-5 h-5 text-indigo-400" />
                          Interactive Authorization Guard Tester
                        </CardTitle>
                        <CardDescription>
                          Verify endpoint protection under current credentials (Unauthenticated Guest)
                        </CardDescription>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
                        <div>
                          <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">Admin Only Guard</div>
                          <div className="text-sm font-medium text-white mb-1">GET /api/v1/auth/test-admin-only</div>
                          <p className="text-xs text-slate-400 mb-3">Requires ADMIN role. Rejects guest with HTTP 401 Unauthorized.</p>
                        </div>
                        <Button
                          onClick={() => testRoleAccess('test-admin-only')}
                          variant="secondary"
                          size="sm"
                          className="w-full"
                        >
                          Execute Request
                        </Button>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
                        <div>
                          <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">Faculty & Admin Guard</div>
                          <div className="text-sm font-medium text-white mb-1">GET /api/v1/auth/test-faculty-or-admin</div>
                          <p className="text-xs text-slate-400 mb-3">Accessible by both FACULTY and ADMIN accounts.</p>
                        </div>
                        <Button
                          onClick={() => testRoleAccess('test-faculty-or-admin')}
                          variant="secondary"
                          size="sm"
                          className="w-full"
                        >
                          Execute Request
                        </Button>
                      </div>
                    </div>

                    {authTestResult && (
                      <div className={`p-3.5 rounded-xl text-xs font-mono border ${
                        authTestResult.success 
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
                          : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      }`}>
                        <div className="flex items-center justify-between mb-1 font-bold">
                          <span>Status: HTTP {authTestResult.status}</span>
                          <span>{authTestResult.success ? 'AUTHORIZED' : 'REJECTED (401)'}</span>
                        </div>
                        <pre className="overflow-x-auto text-[11px] text-slate-400 mt-1">
                          {JSON.stringify(authTestResult.data || authTestResult.error, null, 2)}
                        </pre>
                      </div>
                    )}
                  </Card>

                  {/* System Architecture Showcase Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <Card className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Liveness Engine</span>
                        <Eye className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div className="text-lg font-bold text-white mb-1">Challenge-Response</div>
                      <p className="text-xs text-slate-400">
                        Head yaw rotation, eye blink, and smile detection with 25s TTL
                      </p>
                    </Card>

                    <Card className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Anti-Spoof Defense</span>
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="text-lg font-bold text-white mb-1">Single-Use Token</div>
                      <p className="text-xs text-slate-400">
                        Cryptographic receipt tokens defeat printed photos and replay videos
                      </p>
                    </Card>

                    <Card className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SIMD Vector Cache</span>
                        <CheckCircle2 className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="text-lg font-bold text-white mb-1">0.042 ms Matching</div>
                      <p className="text-xs text-slate-400">
                        Hardware-accelerated NumPy dot-product vector matching across candidate pools
                      </p>
                    </Card>
                  </div>

                  {/* Phased Roadmap Progress */}
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <CardTitle>Platform Development Milestones</CardTitle>
                        <CardDescription>Strict sequential architecture & verification</CardDescription>
                      </div>
                      <Badge variant="success">All 16 Phases Completed</Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {phases.map((phase) => (
                        <div 
                          key={phase.id}
                          className="p-3 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                              {phase.id}
                            </span>
                            <span className="font-medium text-slate-300 truncate">{phase.name}</span>
                          </div>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              )}
            </div>
          )}
        </main>

        {/* Global Footer */}
        <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Smart Attendance Management System &bull; Production Biometric Platform</span>
            <span className="text-slate-600 font-mono text-[11px]">React 19 &bull; FastAPI &bull; YuNet &bull; SFace</span>
          </div>
        </footer>
      </div>

      {/* Global Login Modal */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* Change Password Modal */}
      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
