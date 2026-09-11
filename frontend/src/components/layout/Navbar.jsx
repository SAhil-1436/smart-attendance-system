import React from 'react';
import { 
  Menu, 
  LogIn, 
  LogOut, 
  ShieldCheck, 
  Activity, 
  Sparkles,
  Search,
  Bell,
  ScanFace,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export default function Navbar({ 
  activeTab, 
  onToggleMobileMenu, 
  onOpenLogin,
  onOpenChangePassword,
  health,
  onLaunchKiosk
}) {
  const { user, isAuthenticated, logout } = useAuth();

  const tabTitles = {
    overview: { title: 'Executive Overview', breadcrumb: 'Dashboard' },
    faculty: { title: 'Faculty & Teaching Staff', breadcrumb: 'Staff Management' },
    students: { title: 'Student Directory', breadcrumb: 'Academic Records' },
    attendance: { title: 'Attendance Sessions', breadcrumb: 'Lecture Management' },
    reports: { title: 'Reports & Export Center', breadcrumb: 'Institutional Data' },
    recognition: { title: 'Face Recognition Arena', breadcrumb: 'Biometric Sandbox' },
    liveness: { title: 'Liveness & Anti-Spoofing', breadcrumb: 'Security Verification' },
  };

  const current = tabTitles[activeTab] || tabTitles.overview;

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
      {/* Left: Mobile Toggle & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <span>Smart Attendance</span>
            <span>/</span>
            <span className="text-slate-300 font-semibold">{current.breadcrumb}</span>
          </div>
          <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-none mt-0.5">
            {current.title}
          </h1>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* System Health Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-950/70 border border-slate-800 text-[11px] font-medium text-slate-300">
          <span
            className={`w-2 h-2 rounded-full ${
              health?.status === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span>{health?.status === 'healthy' ? 'CV Engine Online' : 'Connecting...'}</span>
        </div>

        {/* Auth CTA */}
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-semibold text-white leading-tight">{user?.full_name}</span>
              <span className="text-[10px] text-indigo-400 font-mono uppercase">{user?.role}</span>
            </div>
            <button
              onClick={onOpenChangePassword}
              title="Change Password"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-400 border border-slate-700/60 transition"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700/60 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Button onClick={onOpenLogin} size="sm" variant="primary">
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Button>
        )}
      </div>
    </header>
  );
}
