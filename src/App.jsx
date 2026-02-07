import React, { useState, useEffect, useMemo } from 'react';
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
  Calendar,
  Tag,
  Users,
  PieChart as PieIcon,
  X,
  Mail,
  Key,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend 
} from 'recharts';

// Global reference for Supabase
let supabaseInstance = null;
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

const App = () => {
  // --- AUTH & USER STATE ---
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authData, setAuthData] = useState({ email: '', password: '', name: '' });
  const [errorMsg, setErrorMsg] = useState('');

  // --- APP DATA STATE ---
  const [view, setView] = useState('dashboard');
  const [tasks, setTasks] = useState([]);
  const [partners, setPartners] = useState([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', project: 'General', assigned_to: '', due_date: '' });

  // --- INITIALIZATION ---
  useEffect(() => {
    let isMounted = true;

    const initSupabase = () => {
      if (!window.supabase) {
        if (isMounted) {
          setErrorMsg("Supabase library not loaded. Check your script tags.");
          setLoading(false);
        }
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
            setErrorMsg("Supabase credentials missing in environment variables.");
            setLoading(false);
          }
          return;
        }

        if (!supabaseInstance) {
          supabaseInstance = window.supabase.createClient(url, key);
        }

        supabaseInstance.auth.getSession().then(({ data: { session } }) => {
          if (isMounted) {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            setLoading(false);
          }
        });

        const { data: { subscription } } = supabaseInstance.auth.onAuthStateChange((_event, session) => {
          if (isMounted) {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            else {
              setProfile(null);
              setTasks([]);
              setPartners([]);
            }
          }
        });

        return () => subscription.unsubscribe();
      } catch (err) {
        if (isMounted) {
          setErrorMsg("Failed to initialize database connection.");
          setLoading(false);
        }
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
    } else {
      initSupabase();
    }

    return () => { isMounted = false; };
  }, []);

  // Fetch data when session/profile is available
  useEffect(() => {
    if (session && profile && supabaseInstance) {
      fetchTasks();
      if (profile.role === 'admin') fetchPartners();
    }
  }, [session, profile]);

  // --- DB HELPERS ---
  const fetchProfile = async (userId) => {
    const { data } = await supabaseInstance.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  };

  const fetchTasks = async () => {
    let query = supabaseInstance.from('tasks').select('*');
    if (profile?.role !== 'admin') query = query.eq('assigned_to', session.user.id);
    const { data } = await query.order('created_at', { ascending: false });
    if (data) setTasks(data || []);
  };

  const fetchPartners = async () => {
    const { data } = await supabaseInstance.from('profiles').select('*');
    if (data) setPartners(data || []);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const redirectUrl = window.location.origin; // Dynamically handle redirect back to this site

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
        alert("Verification email sent! Please check your inbox to activate your account.");
      } else {
        const { error } = await supabaseInstance.auth.signInWithPassword({
          email: authData.email,
          password: authData.password,
        });
        if (error) throw error;
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskStatus = async (task) => {
    const nextStatus = task.status === 'Pending' ? 'In Progress' : task.status === 'In Progress' ? 'Completed' : 'Pending';
    const { error } = await supabaseInstance.from('tasks').update({ status: nextStatus }).eq('id', task.id);
    if (!error) fetchTasks();
  };

  // --- STATS ---
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const statusData = [
      { name: 'Pending', value: tasks.filter(t => t.status === 'Pending').length },
      { name: 'In Progress', value: tasks.filter(t => t.status === 'In Progress').length },
      { name: 'Completed', value: completed },
    ];
    return { total, completed, statusData };
  }, [tasks]);

  // --- RENDERING ---
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-600"></div>
    </div>
  );

  if (errorMsg && !session) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-center">
      <div className="bg-white p-12 rounded-[3rem] shadow-xl max-w-md">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
        <h2 className="text-2xl font-black text-slate-900 mb-4 uppercase">System Setup Required</h2>
        <p className="text-slate-500 mb-6">{errorMsg}</p>
        <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl">Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are provided in your environment settings.</p>
      </div>
    </div>
  );

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md border border-white">
        <div className="flex justify-center mb-8">
          <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-100">
            <ShieldCheck className="text-white w-8 h-8" />
          </div>
        </div>
        <h2 className="text-3xl font-black text-center text-slate-900 mb-2 uppercase tracking-tighter">
          {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-center text-slate-400 font-bold mb-10 text-xs uppercase tracking-widest">
          {window.location.hostname}
        </p>
        
        <form onSubmit={handleAuth} className="space-y-5">
          {authMode === 'signup' && (
            <div className="relative">
              <User className="absolute left-4 top-4 text-slate-300" size={20} />
              <input 
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none font-bold transition-all"
                placeholder="Full Name"
                required
                onChange={e => setAuthData({...authData, name: e.target.value})}
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-4 text-slate-300" size={20} />
            <input 
              type="email"
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none font-bold transition-all"
              placeholder="Email Address"
              required
              onChange={e => setAuthData({...authData, email: e.target.value})}
            />
          </div>
          <div className="relative">
            <Key className="absolute left-4 top-4 text-slate-300" size={20} />
            <input 
              type="password"
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none font-bold transition-all"
              placeholder="Password"
              required
              onChange={e => setAuthData({...authData, password: e.target.value})}
            />
          </div>
          <button className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
            {authMode === 'login' ? 'Authenticate' : 'Register Account'}
          </button>
        </form>
        
        <button 
          onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
          className="w-full mt-6 text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors"
        >
          {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col md:flex-row">
      {/* Sidebar */}
      <nav className="w-full md:w-72 bg-white border-r p-6 flex flex-col gap-2 z-50">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-100">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <span className="font-black text-2xl tracking-tighter text-indigo-950 uppercase">TaskFlow</span>
        </div>

        <div className="flex-1 space-y-2">
          <NavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20}/>} label="Dashboard" />
          <NavItem active={view === 'tasks'} onClick={() => setView('tasks')} icon={<ListTodo size={20}/>} label={profile?.role === 'admin' ? "All Tasks" : "My Assignments"} />
          {profile?.role === 'admin' && (
             <NavItem active={view === 'partners'} onClick={() => setView('partners')} icon={<Users size={20}/>} label="Team Management" />
          )}
        </div>

        <div className="mt-auto pt-6 border-t border-slate-100">
          <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black shrink-0">
              {profile?.name?.[0] || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{profile?.name || 'User'}</p>
              <p className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">{profile?.role}</p>
            </div>
          </div>
          <button 
            onClick={() => supabaseInstance?.auth.signOut()}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all font-bold text-sm"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-8 md:p-12 max-w-7xl mx-auto w-full overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase mb-2">{view}</h1>
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">
              {profile?.role === 'admin' ? 'Administrative Control' : 'Standard Access'}
            </p>
          </div>
          {view === 'tasks' && profile?.role === 'admin' && (
            <button className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700">
              Create New Task
            </button>
          )}
        </header>

        {view === 'dashboard' && (
          <div className="space-y-10">
            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label="Total Tasks" value={stats.total} icon={<ListTodo className="text-indigo-500" />} />
              <StatCard label="Active" value={stats.total - stats.completed} icon={<Clock className="text-amber-500" />} />
              <StatCard label="Completed" value={stats.completed} icon={<CheckCircle2 className="text-emerald-500" />} />
            </div>

            {/* Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border shadow-sm">
                <div className="flex items-center gap-3 mb-10">
                  <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><PieIcon size={20}/></div>
                  <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Efficiency Metrics</h3>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.statusData} innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value">
                        {stats.statusData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="middle" align="right" layout="vertical" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-indigo-600 text-white p-10 rounded-[3rem] shadow-2xl shadow-indigo-200">
                  <h4 className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-4">Current Partner</h4>
                  <p className="text-2xl font-black mb-2">{profile?.name}</p>
                  <p className="text-sm font-bold opacity-80">{profile?.email}</p>
                </div>
                <div className="bg-white p-10 rounded-[3rem] border">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Quick Overview</h4>
                  <div className="space-y-4">
                     <div className="flex justify-between items-center text-sm font-bold">
                       <span className="text-slate-500">Task Completion Rate</span>
                       <span>{stats.total > 0 ? Math.round((stats.completed/stats.total)*100) : 0}%</span>
                     </div>
                     <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                       <div className="bg-emerald-500 h-full transition-all duration-1000" style={{width: `${stats.total > 0 ? (stats.completed/stats.total)*100 : 0}%`}}></div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'tasks' && (
          <div className="bg-white rounded-[3rem] border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b">
                  <tr>
                    <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-widest">Assignment Detail</th>
                    <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Deadline</th>
                    <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Progress Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.map(task => (
                    <tr key={task.id} className="hover:bg-indigo-50/20 transition-all group">
                      <td className="px-10 py-8">
                        <p className="text-xl font-black text-slate-900 mb-1">{task.title}</p>
                        <div className="flex items-center gap-2">
                          <Tag size={12} className="text-indigo-400" />
                          <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md">{task.project}</span>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-center font-bold text-slate-400 text-sm">
                        {task.due_date || 'N/A'}
                      </td>
                      <td className="px-10 py-8 text-right">
                        <button 
                          onClick={() => toggleTaskStatus(task)}
                          className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            task.status === 'Completed' ? 'bg-emerald-500 text-white border-emerald-600' : 
                            task.status === 'In Progress' ? 'bg-amber-400 text-white border-amber-500' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-400'
                          }`}
                        >
                          {task.status}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-10 py-20 text-center">
                        <p className="text-slate-300 font-black uppercase tracking-widest text-xs">Zero tasks in current scope</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'partners' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partners.map(p => (
              <div key={p.id} className="bg-white p-10 rounded-[3rem] border hover:shadow-xl transition-all group">
                <div className="flex items-center gap-5 mb-8">
                  <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-xl shadow-indigo-100 group-hover:scale-110 transition-transform">
                    {p.name?.[0]}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{p.name}</h3>
                    <p className="text-xs font-black uppercase text-indigo-500 tracking-widest">{p.role}</p>
                  </div>
                </div>
                <div className="space-y-3 pt-6 border-t border-slate-50">
                  <div className="flex items-center gap-2 text-slate-400 text-sm font-bold">
                    <Mail size={14} /> {p.email}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

// UI Components
const NavItem = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
  >
    {icon} <span>{label}</span>
    {active && <ChevronRight className="ml-auto opacity-50" size={16} />}
  </button>
);

const StatCard = ({ label, value, icon }) => (
  <div className="bg-white p-8 rounded-[2.5rem] border flex items-center justify-between hover:shadow-2xl transition-all duration-500 group">
    <div>
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">{label}</p>
      <p className="text-5xl font-black text-slate-900 tracking-tighter">{value}</p>
    </div>
    <div className="bg-slate-50 p-6 rounded-[2rem] group-hover:bg-indigo-50 transition-all">{icon}</div>
  </div>
);

export default App;

