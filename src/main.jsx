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
  Key
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
 * Fixed ReactSharedInternals error by using named imports and 
 * ensuring compatibility with the environment's React version.
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
  const [newTask, setNewTask] = useState({ title: '', project: 'General', assigned_to: '', due_date: '' });

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
      if (data) setProfile(data);
    } catch (err) {
      console.error("Profile fetch error", err);
    }
  };

  const fetchTasks = async () => {
    try {
      let query = supabaseInstance.from('tasks').select('*');
      if (profile?.role !== 'admin') query = query.eq('assigned_to', session.user.id);
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
    if (session && profile && supabaseInstance) {
      fetchTasks();
      if (profile.role === 'admin') fetchPartners();
    }
  }, [session, profile]);

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
      const { error } = authMode === 'signup' 
        ? await supabaseInstance.auth.signUp({ 
            email: authData.email, 
            password: authData.password, 
            options: { data: { name: authData.name } } 
          })
        : await supabaseInstance.auth.signInWithPassword({ 
            email: authData.email, 
            password: authData.password 
          });
      if (error) throw error;
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

  if (errorMsg && !session) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md text-center">
        <ShieldCheck className="w-12 h-12 text-indigo-600 mx-auto mb-4"/>
        <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
        <p className="text-slate-500 text-sm mb-4">{errorMsg}</p>
        <div className="text-[10px] text-slate-400 font-mono bg-slate-50 p-3 rounded-lg overflow-hidden">
          Check browser console for environment resolution logs.
        </div>
      </div>
    </div>
  );

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-black text-center mb-8 uppercase tracking-tight">TaskFlow Auth</h2>
        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'signup' && (
            <input 
              className="w-full p-4 bg-slate-50 rounded-xl border-none font-bold" 
              placeholder="Name" 
              onChange={e => setAuthData({...authData, name: e.target.value})} 
            />
          )}
          <input 
            className="w-full p-4 bg-slate-50 rounded-xl border-none font-bold" 
            type="email" 
            placeholder="Email" 
            onChange={e => setAuthData({...authData, email: e.target.value})} 
          />
          <input 
            className="w-full p-4 bg-slate-50 rounded-xl border-none font-bold" 
            type="password" 
            placeholder="Password" 
            onChange={e => setAuthData({...authData, password: e.target.value})} 
          />
          <button className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg">
            {authMode === 'login' ? 'Authenticate' : 'Register'}
          </button>
        </form>
        <button 
          onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} 
          className="w-full mt-4 text-sm font-bold text-slate-400"
        >
          {authMode === 'login' ? 'Create account' : 'Have an account?'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      <nav className="w-full md:w-64 bg-white border-r p-6 flex flex-col gap-2">
        <div className="font-black text-xl mb-8 flex items-center gap-2">
          <ShieldCheck className="text-indigo-600"/> TASKFLOW
        </div>
        <button 
          onClick={() => setView('dashboard')} 
          className={`p-4 rounded-xl text-left font-bold text-xs uppercase tracking-widest ${view === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
        >
          Dashboard
        </button>
        <button 
          onClick={() => setView('tasks')} 
          className={`p-4 rounded-xl text-left font-bold text-xs uppercase tracking-widest ${view === 'tasks' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
        >
          Tasks
        </button>
        <button 
          onClick={() => supabaseInstance.auth.signOut()} 
          className="mt-auto p-4 text-left font-bold text-xs uppercase tracking-widest text-red-400"
        >
          <LogOut size={16} className="inline mr-2"/> Sign Out
        </button>
      </nav>

      <main className="flex-1 p-8">
        <header className="flex justify-between items-center mb-10">
          <h1 className="text-4xl font-black uppercase tracking-tighter">{view}</h1>
          {view === 'tasks' && profile?.role === 'admin' && (
            <button 
              onClick={() => setIsAddingTask(true)} 
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-xs"
            >
              NEW TASK
            </button>
          )}
        </header>

        {view === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border h-[400px]">
              <h3 className="font-bold mb-6 uppercase text-xs tracking-widest text-slate-400">Progress Breakdown</h3>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie 
                    data={stats.statusData} 
                    innerRadius={60} 
                    outerRadius={80} 
                    paddingAngle={5} 
                    dataKey="value"
                  >
                    {stats.statusData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 gap-4 h-fit">
              <div className="bg-white p-6 rounded-3xl border">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Total Tasks</p>
                <p className="text-3xl font-black">{stats.total}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Completed</p>
                <p className="text-3xl font-black text-emerald-500">{stats.completed}</p>
              </div>
            </div>
          </div>
        )}

        {view === 'tasks' && (
          <div className="bg-white rounded-3xl border overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                <tr>
                  <th className="p-6">Task</th>
                  <th className="p-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tasks.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-6 font-bold">{t.title}</td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        t.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : 
                        t.status === 'In Progress' ? 'bg-amber-100 text-amber-600' : 
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan="2" className="p-10 text-center text-slate-400 font-bold">No tasks found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

// Fixed entry point to prevent ReactSharedInternals TypeError
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}