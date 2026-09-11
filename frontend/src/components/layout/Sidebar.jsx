import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  CalendarCheck, 
  FileText, 
  ScanFace, 
  Eye, 
  Camera, 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  LogIn, 
  ShieldCheck, 
  Sparkles,
  GraduationCap,
  KeyRound
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';

export default function Sidebar({ 
  activeTab, 
  onSelectTab, 
  isCollapsed, 
  onToggleCollapse, 
  onOpenLogin,
  onOpenChangePassword 
}) {
  const { user, isAuthenticated, logout } = useAuth();

  const navItems = [
    {
      id: 'overview',
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'System overview & KPIs',
    },
    {
      id: 'faculty',
      label: 'Teachers / Faculty',
      icon: GraduationCap,
      description: 'Staff & Login Credentials',
      authRequired: true,
      adminOnly: true,
    },
    {
      id: 'students',
      label: 'Students',
      icon: Users,
      description: 'Directory & Face Enrollment',
      authRequired: true,
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: CalendarCheck,
      description: 'Sessions & Live Kiosk',
      authRequired: true,
    },
    {
      id: 'reports',
      label: 'Reports & Export',
      icon: FileText,
      description: 'PDF, Excel & CSV Analytics',
      authRequired: true,
    },
    {
      id: 'recognition',
      label: 'Face Recognition',
      icon: ScanFace,
      description: '1-to-N Match Sandbox',
      authRequired: true,
    },
    {
      id: 'liveness',
      label: 'Anti-Spoofing',
      icon: Eye,
      description: 'Challenge-Response Tester',
      authRequired: true,
    },
  ];

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && isAuthenticated && user?.role !== 'ADMIN') {
      return false;
    }
    return true;
  });

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r border-slate-800/80 bg-slate-900/70 backdrop-blur-xl transition-all duration-300 z-30 h-screen sticky top-0',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 shadow-inner flex-shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col transition-opacity duration-200">
              <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5 leading-none">
                SmartFace
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </span>
              <span className="text-[10px] text-slate-400 tracking-wide font-medium mt-0.5">
                AI Attendance Platform
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        <div className="px-2 mb-2">
          {!isCollapsed && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Main Menu
            </span>
          )}
        </div>

        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isLocked = item.authRequired && !isAuthenticated;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative',
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/25 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110',
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                )}
              />

              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between overflow-hidden text-left">
                  <span className="truncate">{item.label}</span>
                  {isLocked && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-500 border border-slate-700">
                      Auth
                    </span>
                  )}
                </div>
              )}

              {/* Active Indicator Strip */}
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-white shadow-sm" />
              )}
            </button>
          );
        })}
      </div>

      {/* User Profile / Auth Area */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
        {isAuthenticated ? (
          <div
            className={cn(
              'flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/50 border border-slate-700/60',
              isCollapsed && 'justify-center p-2'
            )}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-xs text-white flex-shrink-0 shadow-md">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>

            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {user?.full_name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant={user?.role === 'ADMIN' ? 'default' : 'secondary'} className="text-[9px] px-1.5 py-0">
                    {user?.role}
                  </Badge>
                </div>
              </div>
            )}

            <button
              onClick={onOpenChangePassword}
              title="Change Password"
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition"
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenLogin}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-md shadow-indigo-600/20',
              isCollapsed && 'p-2'
            )}
          >
            <LogIn className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Sign In</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
