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
    try {
      const { data } = await supabaseInstance.from('profiles').select('*').eq('id', userId).single();
      if (data) setProfile(data);
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };

  const fetchTasks = async () => {
    try {
      let query = supabaseInstance.from('tasks').select('*');
      if (profile?.role !== 'admin') query = query.eq('assigned_to', session.user.id);
      const { data } = await query.order('created_at', { ascending: false });
      if (data) setTasks(data || []);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    }
  };

  const fetchPartners = async () => {
    try {
      const { data } = await supabaseInstance.from('profiles').select('*');
      if (data) setPartners(data || []);
    } catch (err) {
      console.error("Error fetching partners:", err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
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
        alert("Verification email sent! Please check your inbox to activate your account.");
      } else {
        const { error } = await supabaseInstance.auth.signInWithPassword({
          email: authData.email,
          password: authData.password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setErrorMsg(err.message);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskStatus = async (task) => {
    const nextStatus = task.status === 'Pending' ? 'In Progress' : task.status === 'In Progress' ? 'Completed' : 'Pending';
    const { error } = await supabaseInstance.from('tasks').update({ status: nextStatus }).eq('id', task.id);
    if (!error) fetchTasks();
    else alert("Failed to update task status");
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabaseInstance.from('tasks').insert([{
        ...newTask,
        created_by: session.user.id,
        status: 'Pending'
      }]);
      if (error) throw error;
      setIsAddingTask(false);
      setNewTask({ title: '', project: 'General', assigned_to: '', due_date: '' });
      fetchTasks();
    } catch (err) {
      alert("Failed to create task: " + err.message);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    const { error } = await supabaseInstance.from('tasks').delete().eq('id', taskId);
    if (!error) fetchTasks();
    else alert("Failed to delete task");
  };

  // --- STATS ---
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const pending = tasks.filter(t => t.status === 'Pending').length;
    
    return {
      total,
      completed,
      inProgress,
      pending,
      statusData: [
        { name: 'Pending', value: pending },
        { name: 'In Progress', value: inProgress },
        { name: 'Completed', value: completed },
      ]
    };
  }, [tasks]);

  // --- LOADING STATE ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Initializing TaskFlow...</p>
        </div>
      </div>
    );
  }

  // --- ERROR STATE ---
  if (errorMsg && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black mb-2 uppercase tracking-tight text-slate-900">Configuration Error</h2>
          <p className="text-slate-600 mb-4">{errorMsg}</p>
          <p className="text-xs text-slate-400 font-bold">Please check your environment variables and try again.</p>
        </div>
      </div>
    );
  }

  // --- AUTH SCREEN ---
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50 p-6">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md border border-slate-100">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-[2rem] mb-6 shadow-xl shadow-indigo-200">
              <ShieldCheck className="text-white" size={40} />
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase mb-2 text-slate-900">TaskFlow</h1>
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Project Management System</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Full Name</label>
                <input 
                  className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold outline-none" 
                  placeholder="Enter your name" 
                  required 
                  value={authData.name}
                  onChange={e => setAuthData({...authData, name: e.target.value})} 
                />
              </div>
            )}
            
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Email Address</label>
              <input 
                className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold outline-none" 
                type="email" 
                placeholder="you@company.com" 
                required 
                value={authData.email}
                onChange={e => setAuthData({...authData, email: e.target.value})} 
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Password</label>
              <input 
                className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold outline-none" 
                type="password" 
                placeholder="••••••••" 
                required 
                value={authData.password}
                onChange={e => setAuthData({...authData, password: e.target.value})} 
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setAuthData({ email: '', password: '', name: '' });
              }}
              className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors"
            >
              {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP ---
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <nav className="w-80 bg-white border-r border-slate-100 p-8 flex flex-col">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
              <ShieldCheck className="text-white" size={24} />
            </div>
            <h1 className="text-2xl font-black tracking-tighter uppercase">TaskFlow</h1>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-16">Management System</p>
        </div>

        <div className="space-y-3 flex-1">
          <NavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20}/>} label="Dashboard" />
          <NavItem active={view === 'tasks'} onClick={() => setView('tasks')} icon={<ListTodo size={20}/>} label="Tasks" />
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
              <p className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">{profile?.role || 'partner'}</p>
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
            <button 
              onClick={() => setIsAddingTask(true)}
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 flex items-center gap-2"
            >
              <Plus size={18} />
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
                  <p className="text-sm font-bold opacity-80">{profile?.email || session?.user?.email}</p>
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
                    {profile?.role === 'admin' && (
                      <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                    )}
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
                      {profile?.role === 'admin' && (
                        <td className="px-10 py-8 text-right">
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={profile?.role === 'admin' ? "4" : "3"} className="px-10 py-20 text-center">
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
                    {p.name?.[0] || 'U'}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{p.name || 'User'}</h3>
                    <p className="text-xs font-black uppercase text-indigo-500 tracking-widest">{p.role || 'partner'}</p>
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

      {/* Create Task Modal */}
      {isAddingTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-[3rem] p-10 max-w-2xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-black uppercase tracking-tighter">Create New Task</h2>
              <button 
                onClick={() => setIsAddingTask(false)}
                className="p-2 rounded-xl hover:bg-slate-100 transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateTask} className="space-y-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Task Title</label>
                <input
                  type="text"
                  required
                  value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold outline-none"
                  placeholder="Enter task title..."
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Project</label>
                <input
                  type="text"
                  value={newTask.project}
                  onChange={e => setNewTask({...newTask, project: e.target.value})}
                  className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold outline-none"
                  placeholder="Project name..."
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Assign To (User ID)</label>
                <select
                  value={newTask.assigned_to}
                  onChange={e => setNewTask({...newTask, assigned_to: e.target.value})}
                  className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold outline-none"
                >
                  <option value="">Select partner...</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Due Date</label>
                <input
                  type="date"
                  value={newTask.due_date}
                  onChange={e => setNewTask({...newTask, due_date: e.target.value})}
                  className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold outline-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingTask(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
