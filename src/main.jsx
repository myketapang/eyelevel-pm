import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  LayoutDashboard, 
  CheckCircle2, 
  Clock, 
  ListTodo, 
  Plus, 
  LogOut, 
  ShieldCheck, 
  User,
  Trash2,
  Tag,
  Users,
  PieChart as PieIcon,
  X,
  Mail,
  Key,
  AlertCircle,
  Settings
} from 'lucide-react';
import { 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend 
} from 'recharts';

/**
 * APPLICATION COMPONENT
 * To access as Admin: 
 * 1. Ensure your Supabase 'profiles' table has a 'role' column.
 * 2. Set the 'role' value to 'admin' for your specific user ID.
 * 3. I've added a temporary "Admin Toggle" in the sidebar for testing purposes.
 */

let supabaseInstance = null;
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

const App = () => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authData, setAuthData] = useState({ email: '', password: '', name: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [view, setView] = useState('dashboard');
  const [tasks, setTasks] = useState([]);
  const [partners, setPartners] = useState([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  
  // Admin Simulation Toggle (For Preview Verification)
  const [isAdminOverride, setIsAdminOverride] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const initSupabase = () => {
      if (!window.supabase) {
        if (isMounted) { setErrorMsg("Supabase SDK not found."); setLoading(false); }
        return;
      }
      try {
        let url = '', key = '';
        try {
          if (typeof import.meta !== 'undefined' && import.meta.env) {
            url = import.meta.env.VITE_SUPABASE_URL || '';
            key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
          }
        } catch (e) {}

        if (!url || !key) {
          if (isMounted) { 
            setErrorMsg("Supabase credentials missing. Ensure environment variables are set."); 
            setLoading(false); 
          }
          return;
        }

        if (!supabaseInstance) supabaseInstance = window.supabase.createClient(url, key);

        supabaseInstance.auth.getSession().then(({ data: { session: currentSession } }) => {
          if (isMounted) {
            setSession(currentSession);
            if (currentSession) fetchProfile(currentSession.user.id);
            setLoading(false);
          }
        });

        const { data: { subscription } } = supabaseInstance.auth.onAuthStateChange((_event, newSession) => {
          if (isMounted) {
            setSession(newSession);
            if (newSession) fetchProfile(newSession.user.id);
            else setProfile(null);
          }
        });
        return () => subscription.unsubscribe();
      } catch (err) {
        if (isMounted) { setErrorMsg("Initialization error."); setLoading(false); }
      }
    };

    const scriptId = 'supabase-sdk';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.onload = initSupabase;
      document.body.appendChild(script);
    } else initSupabase();

    return () => { isMounted = false; };
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const { data } = await supabaseInstance.from('profiles').select('*').eq('id', userId).single();
      if (data) {
        setProfile(data);
        if (data.role === 'admin') setIsAdminOverride(true);
      }
    } catch (err) {
      console.error("Profile fetch error", err);
    }
  };

  const fetchTasks = async () => {
    try {
      let query = supabaseInstance.from('tasks').select('*');
      // Use override logic for testing UI
      if (!isAdminOverride && profile?.role !== 'admin') {
        query = query.eq('assigned_to', session.user.id);
      }
      const { data } = await query.order('created_at', { ascending: false });
      if (data) setTasks(data);
    } catch (err) {
      console.error("Task fetch error", err);
    }
  };

  const fetchPartners = async () => {
    try {
      const { data } = await supabaseInstance.from('profiles').select('*');
      if (data) setPartners(data);
    } catch (err) {
      console.error("Partners fetch error", err);
    }
  };

  useEffect(() => {
    if (session && supabaseInstance) {
      fetchTasks();
      if (isAdminOverride || profile?.role === 'admin') fetchPartners();
    }
  }, [session, profile, isAdminOverride]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    return {
      total, completed,
      statusData: [
        { name: 'Pending', value: tasks.filter(t => t.status === 'Pending').length },
        { name: 'In Progress', value: tasks.filter(t => t.status === 'In Progress').length },
        { name: 'Completed', value: completed },
      ]
    };
  }, [tasks]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const redirectUrl = window.location.origin;
      if (authMode === 'signup') {
        const { error } = await supabaseInstance.auth.signUp({ 
          email: authData.email, 
          password: authData.password, 
          options: { 
            data: { name: authData.name },
            emailRedirectTo: redirectUrl
          } 
        });
        if (error) throw error;
        alert("Verification email sent! Please check your inbox.");
      } else {
        const { error } = await supabaseInstance.auth.signInWithPassword({ 
          email: authData.email, 
          password: authData.password 
        });
        if (error) throw error;
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-600"></div>
    </div>
  );

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-black text-center mb-2 uppercase tracking-tight">TaskFlow</h2>
        <p className="text-center text-slate-400 text-xs font-bold mb-8 uppercase tracking-widest">Environment: {window.location.hostname}</p>
        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'signup' && (
            <input className="w-full p-4 bg-slate-50 rounded-xl border-none font-bold" placeholder="Name" required onChange={e => setAuthData({...authData, name: e.target.value})} />
          )}
          <input className="w-full p-4 bg-slate-50 rounded-xl border-none font-bold" type="email" placeholder="Email" required onChange={e => setAuthData({...authData, email: e.target.value})} />
          <input className="w-full p-4 bg-slate-50 rounded-xl border-none font-bold" type="password" placeholder="Password" required onChange={e => setAuthData({...authData, password: e.target.value})} />
          <button className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg">{authMode === 'login' ? 'Sign In' : 'Create Account'}</button>
        </form>
        <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full mt-4 text-sm font-bold text-slate-400">{authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Login"}</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      <nav className="w-full md:w-64 bg-white border-r p-6 flex flex-col gap-2">
        <div className="font-black text-xl mb-8 flex items-center gap-2">
          <ShieldCheck className="text-indigo-600"/> TASKFLOW
        </div>
        <button onClick={() => setView('dashboard')} className={`p-4 rounded-xl text-left font-bold text-xs uppercase tracking-widest transition-all ${view === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Dashboard</button>
        <button onClick={() => setView('tasks')} className={`p-4 rounded-xl text-left font-bold text-xs uppercase tracking-widest transition-all ${view === 'tasks' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Tasks</button>
        
        {/* DEV ONLY: Admin Simulator */}
        <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Dev Simulation</p>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-[10px] font-bold text-slate-600 uppercase">Admin Mode</span>
            <input 
              type="checkbox" 
              checked={isAdminOverride} 
              onChange={() => setIsAdminOverride(!isAdminOverride)}
              className="w-4 h-4 accent-indigo-600"
            />
          </label>
        </div>

        <button onClick={() => supabaseInstance.auth.signOut()} className="mt-auto p-4 text-left font-bold text-xs uppercase tracking-widest text-red-400 hover:bg-red-50 rounded-xl transition-all">
          <LogOut size={16} className="inline mr-2"/> Sign Out
        </button>
      </nav>

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">{view}</h1>
            <p className="text-slate-400 text-xs font-bold uppercase mt-1">{isAdminOverride ? 'Administrator' : 'Partner'} View</p>
          </div>
          {view === 'tasks' && isAdminOverride && (
            <button onClick={() => setIsAddingTask(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-xs shadow-lg">NEW TASK</button>
          )}
        </header>

        {view === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border h-[400px]">
              <h3 className="font-bold mb-6 uppercase text-xs tracking-widest text-slate-400">Project Overview</h3>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie data={stats.statusData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {stats.statusData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-3xl border shadow-sm">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{isAdminOverride ? 'Global Scope' : 'My Scope'}</p>
                <p className="text-4xl font-black tracking-tighter">{stats.total}</p>
              </div>
              <div className="bg-indigo-600 p-6 rounded-3xl shadow-lg text-white">
                <p className="text-[10px] font-black uppercase opacity-60 mb-1">Authenticated as</p>
                <p className="text-xl font-bold truncate">{profile?.name || session.user.email}</p>
              </div>
            </div>
          </div>
        )}

        {view === 'tasks' && (
          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                <tr>
                  <th className="p-6">Project / Task</th>
                  <th className="p-6">Status</th>
                  <th className="p-6">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-6">
                      <div className="font-bold text-slate-900">{t.title}</div>
                      <div className="text-[10px] font-bold text-indigo-500 uppercase">{t.project}</div>
                    </td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                        t.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="p-6 text-xs font-bold text-slate-400">{t.due_date || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

const rootContainer = document.getElementById('root');
if (rootContainer) {
  createRoot(rootContainer).render(<App />);
}