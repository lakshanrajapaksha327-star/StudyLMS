import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  Activity,
  Cpu,
  FileText,
  Search,
  MoreVertical,
  CheckCircle,
  AlertTriangle,
  Server,
  Zap,
  Lock
} from 'lucide-react';
import { AdminMetric } from '../types';

interface AdminPanelProps {
  metrics: AdminMetric;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ metrics }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const sampleUsers = [
    { id: 'u1', name: 'Alex Rivera', email: 'alex.rivera@university.edu', role: 'Student', status: 'Active', tokens: '142,500' },
    { id: 'u2', name: 'Dr. Sarah Chen', email: 'schen@mit.edu', role: 'Educator', status: 'Active', tokens: '890,200' },
    { id: 'u3', name: 'Marcus Vance', email: 'mvance@stanford.edu', role: 'Student', status: 'Active', tokens: '45,100' },
    { id: 'u4', name: 'Elena Rostova', email: 'erostova@berkeley.edu', role: 'Student', status: 'Suspended', tokens: '12,000' },
  ];

  const filteredUsers = sampleUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-500" /> Admin Control & System Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitor system health, Gemini token consumption, indexed source documents, and user accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" /> System Status: {metrics.systemHealth}
          </span>
        </div>
      </div>

      {/* Admin Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Total Registered Users</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {metrics.totalUsers.toLocaleString()}
          </p>
          <span className="text-[10px] text-emerald-500 font-semibold">+12% this month</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Active Students Today</span>
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {metrics.activeToday.toLocaleString()}
          </p>
          <span className="text-[10px] text-purple-400 font-semibold">27% peak concurrency</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Gemini AI Tokens Used</span>
            <Cpu className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {(metrics.aiTokensUsed / 1000000).toFixed(2)}M
          </p>
          <span className="text-[10px] text-amber-500 font-semibold">Gemini 2.5 Flash API</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Indexed Sources</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {metrics.documentsIndexed.toLocaleString()}
          </p>
          <span className="text-[10px] text-blue-500 font-semibold">Vector Store Grounded</span>
        </div>
      </div>

      {/* User Management Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" /> User Account Management
          </h3>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search users or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="pb-3">User</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">AI Tokens Consumed</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3.5 font-bold text-slate-900 dark:text-slate-100">
                    <div>{user.name}</div>
                    <div className="text-[11px] font-normal text-slate-400">{user.email}</div>
                  </td>
                  <td className="py-3.5 text-slate-600 dark:text-slate-300 font-semibold">{user.role}</td>
                  <td className="py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        user.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="py-3.5 font-mono text-slate-700 dark:text-slate-300">{user.tokens}</td>
                  <td className="py-3.5 text-right">
                    <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
