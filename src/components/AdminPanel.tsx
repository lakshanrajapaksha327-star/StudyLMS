import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  Activity,
  Cpu,
  FileText,
  Search,
  Server,
  Lock,
  RefreshCw,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { AdminMetric, AiProviderHealthInfo } from '../types';
import {
  fetchAdminOverviewApi,
  updateAdminUserApi,
  deleteAdminUserApi,
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface AdminPanelProps {
  metrics: AdminMetric;
  isAdmin?: boolean;
}

interface AdminUserRow {
  id: string;
  uid?: string;
  name: string;
  email: string;
  role: 'Student' | 'Educator' | 'Admin';
  status?: 'Active' | 'Suspended';
  cardsMastered?: number;
  quizzesCompleted?: number;
  documentsCount?: number;
  createdAt?: string;
}

interface RecentAiError {
  id: string;
  feature: string;
  provider?: string;
  modelName?: string;
  errorCategory?: string;
  message?: string;
  createdAt: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ metrics: fallbackMetrics, isAdmin = false }) => {
  const { user: currentAuthUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [liveMetrics, setLiveMetrics] = useState<AdminMetric>(fallbackMetrics);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [providers, setProviders] = useState<AiProviderHealthInfo[]>([]);
  const [recentAiErrors, setRecentAiErrors] = useState<RecentAiError[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const loadAdminOverview = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await fetchAdminOverviewApi();
      if (data.metrics) setLiveMetrics(data.metrics);
      if (Array.isArray(data.users)) {
        setUsers(
          data.users.map((u: any) => ({
            ...u,
            id: u.uid || u.id,
          }))
        );
      }
      if (Array.isArray(data.aiMonitoring?.providers)) {
        setProviders(data.aiMonitoring.providers);
      }
      if (Array.isArray(data.recentAiErrors)) {
        setRecentAiErrors(data.recentAiErrors);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load admin analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminOverview();
  }, [isAdmin]);

  const handleUpdateUser = async (
    uid: string,
    updates: { role?: 'Student' | 'Educator' | 'Admin'; status?: 'Active' | 'Suspended' }
  ) => {
    setBusyUid(uid);
    setErrorMsg('');
    try {
      await updateAdminUserApi(uid, updates);
      setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, ...updates } : u)));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update user.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    setBusyUid(uid);
    setErrorMsg('');
    try {
      await deleteAdminUserApi(uid);
      setUsers((prev) => prev.filter((u) => u.id !== uid));
      setConfirmDeleteUid(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete user.');
    } finally {
      setBusyUid(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-3">
          <Lock className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Administrator Access Required</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This panel displays live workspace user counts, AI telemetry, and system diagnostics for authorized administrators only.
          </p>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-500" /> Admin Control & System Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Live Firestore user management, multi-provider AI health & circuit breakers, latency metrics, and error logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAdminOverview}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" /> Health: {liveMetrics.systemHealth}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Extended System Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Total Users</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {liveMetrics.totalUsers.toLocaleString()}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Active Today</span>
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {liveMetrics.activeToday.toLocaleString()}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Docs Indexed</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {liveMetrics.documentsIndexed.toLocaleString()}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">AI Requests</span>
            <Cpu className="w-4 h-4 text-cyan-500" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {(liveMetrics.aiRequestsTotal ?? 0).toLocaleString()}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">AI Tokens</span>
            <Cpu className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {liveMetrics.aiTokensUsed.toLocaleString()}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Avg Latency / Errs</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {liveMetrics.avgAiLatencyMs ?? 0}ms{' '}
            <span className="text-xs font-semibold text-rose-400">
              / {liveMetrics.aiErrorsTotal ?? 0} err
            </span>
          </p>
        </div>
      </div>

      {/* AI Provider Health & Circuit States */}
      {providers.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-500" /> AI Provider Health & Circuit Breakers
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="pb-2.5">Provider</th>
                  <th className="pb-2.5">Model</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5">Circuit</th>
                  <th className="pb-2.5">Requests / Failures</th>
                  <th className="pb-2.5">Last Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {providers.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 font-bold text-slate-900 dark:text-slate-100">{p.displayName}</td>
                    <td className="py-3 font-mono text-[11px] text-slate-500">{p.configuredModel}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          p.status === 'healthy'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : p.status === 'unavailable'
                            ? 'bg-slate-500/15 text-slate-400'
                            : 'bg-amber-500/15 text-amber-500'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-[11px]">{p.circuitState}</td>
                    <td className="py-3">
                      {p.totalRequests} / <span className="text-rose-400">{p.totalFailures}</span>
                    </td>
                    <td className="py-3 font-mono text-[11px]">
                      {p.lastLatencyMs !== null ? `${p.lastLatencyMs}ms` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Directory with Role/Status & Delete */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" /> Registered User Directory ({users.length})
          </h3>

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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="pb-3">User</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Cards / Quizzes</th>
                <th className="pb-3">Joined</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    {loading ? 'Loading users...' : 'No matching users found.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((userRow) => {
                  const isSelf =
                    userRow.id === currentAuthUser?.uid ||
                    userRow.email?.toLowerCase() === currentAuthUser?.email?.toLowerCase();
                  return (
                    <tr key={userRow.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 font-bold text-slate-900 dark:text-slate-100">
                        <div>{userRow.name || 'Unnamed User'}</div>
                        <div className="text-[11px] font-normal text-slate-400">{userRow.email}</div>
                      </td>
                      <td className="py-3.5">
                        <select
                          disabled={busyUid === userRow.id || isSelf}
                          value={userRow.role || 'Student'}
                          onChange={(e) =>
                            handleUpdateUser(userRow.id, { role: e.target.value as any })
                          }
                          className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] font-semibold"
                        >
                          <option value="Student">Student</option>
                          <option value="Educator">Educator</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </td>
                      <td className="py-3.5">
                        <select
                          disabled={busyUid === userRow.id || isSelf}
                          value={userRow.status || 'Active'}
                          onChange={(e) =>
                            handleUpdateUser(userRow.id, { status: e.target.value as any })
                          }
                          className={`border rounded-lg px-2 py-1 text-[11px] font-semibold ${
                            userRow.status === 'Suspended'
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                          }`}
                        >
                          <option value="Active">Active</option>
                          <option value="Suspended">Suspended</option>
                        </select>
                      </td>
                      <td className="py-3.5 font-mono text-slate-700 dark:text-slate-300">
                        {userRow.cardsMastered ?? 0} / {userRow.quizzesCompleted ?? 0}
                      </td>
                      <td className="py-3.5 text-slate-400">
                        {userRow.createdAt ? new Date(userRow.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3.5 text-right">
                        {isSelf ? (
                          <span className="text-[10px] text-slate-400 italic">Current Admin</span>
                        ) : confirmDeleteUid === userRow.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              disabled={busyUid === userRow.id}
                              onClick={() => handleDeleteUser(userRow.id)}
                              className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-bold"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDeleteUid(null)}
                              className="px-2 py-1 text-[10px] text-slate-400"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteUid(userRow.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                            title="Delete User Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent AI Errors Log */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500" /> Recent AI Errors ({recentAiErrors.length})
        </h3>
        {recentAiErrors.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No recent AI request failures recorded.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentAiErrors.map((err) => (
              <div
                key={err.id}
                className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="font-bold text-rose-400">
                    {err.feature} • {err.provider || 'unknown'} ({err.modelName || '—'})
                  </span>
                  <p className="text-slate-500 dark:text-slate-300 truncate">{err.message || err.errorCategory}</p>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {new Date(err.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
