import React from 'react';
import { 
  X, 
  Camera, 
  LayoutDashboard, 
  Users, 
  CalendarCheck, 
  FileText, 
  ScanFace, 
  Eye, 
  LogIn, 
  LogOut,
  GraduationCap 
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';

export default function MobileDrawer({ isOpen, onClose, activeTab, onSelectTab, onOpenLogin }) {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isOpen) return null;

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'faculty', label: 'Teachers / Faculty', icon: GraduationCap, authRequired: true, adminOnly: true },
    { id: 'students', label: 'Students Directory', icon: Users, authRequired: true },
    { id: 'attendance', label: 'Attendance Sessions', icon: CalendarCheck, authRequired: true },
    { id: 'reports', label: 'Reports & Export', icon: FileText, authRequired: true },
    { id: 'recognition', label: 'Face Recognition', icon: ScanFace, authRequired: true },
    { id: 'liveness', label: 'Anti-Spoofing Tester', icon: Eye, authRequired: true },
  ];

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && isAuthenticated && user?.role !== 'ADMIN') {
      return false;
    }
    return true;
  });

  const handleSelect = (id) => {
    onSelectTab(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden bg-slate-950/80 backdrop-blur-md flex">
      <div className="w-72 max-w-[80vw] h-full bg-slate-900 border-r border-slate-800 flex flex-col p-4 shadow-2xl animate-in slide-in-from-left duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-white">SmartFace</span>
              <p className="text-[10px] text-slate-400">Attendance Platform</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation links */}
        <div className="flex-1 py-4 space-y-1.5 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* User Footer */}
        <div className="pt-4 border-t border-slate-800">
          {isAuthenticated ? (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div>
                <p className="text-xs font-bold text-white leading-tight">{user?.full_name}</p>
                <Badge variant="default" className="text-[9px] px-1.5 py-0 mt-0.5">{user?.role}</Badge>
              </div>
              <button
                onClick={() => { logout(); onClose(); }}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { onOpenLogin(); onClose(); }}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Backdrop click to close */}
      <div className="flex-1" onClick={onClose} />
    </div>
  );
}
