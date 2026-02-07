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
  BarChart3,
  Tag,
  Briefcase,
  Users,
  PieChart as PieIcon,
  X,
  Eye,
  Lock,
  Mail,
  Key
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend 
} from 'recharts';

// Global reference for Supabase to avoid initialization issues across renders
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
      // Check if library is available on window
      if (!window.supabase) {
        console.error("Supabase library not found on window");
        if (isMounted) {
          setErrorMsg("Failed to load Supabase library. Please check your internet connection.");
          setLoading(false);
        }
        return;
      }

      try {
        // Safe access to environment variables
        // We use a try-catch and specific checks for 'import.meta' to avoid [GLOBAL] Script errors 
        // in environments that restrict access to this object.
        let url = '';
        let key = '';

        // Check if we are in a Vite-like environment
        try {
          // @ts-ignore
          if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            url = import.meta.env.VITE_SUPABASE_URL || '';
            // @ts-ignore
            key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
          }
        } catch (e) {
          console.warn("import.meta.env is inaccessible in this context");
        }

        if (!url || !key) {
          if (isMounted) {
            setErrorMsg("Supabase credentials missing. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.");
            setLoading(false);
          }
          return;
        }

        if (!supabaseInstance) {
          supabaseInstance = window.supabase.createClient(url, key);
        }

        // Check active sessions
        supabaseInstance.auth.getSession().then(({ data: { session } }) => {
          if (isMounted) {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            setLoading(false);
          }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabaseInstance.auth.onAuthStateChange((_event, session) => {
          if (isMounted) {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            else setProfile(null);
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error("Initialization error:", err);
        if (isMounted) {
          setErrorMsg("A system error occurred during initialization.");
          setLoading(false);
        }
      }
    };

    // Load Supabase script dynamically
    const scriptId = 'supabase-sdk';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.onload = initSupabase;
      script.onerror = () => {
        if (isMounted) {
          setErrorMsg("Could not load the database driver.");
          setLoading(false);
        }
      };
      document.body.appendChild(script);
    } else if (window.supabase) {
      initSupabase();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch profiles and tasks when session is valid
  useEffect(() => {
    if (session && profile && supabaseInstance) {
      fetchTasks();
      if (profile.role === 'admin') fetchPartners();
    }
  }, [session, profile]);

  // --- DATABASE OPERATIONS ---
  const fetchProfile = async (userId) => {
    if (!supabaseInstance) return;
    try {
      const { data } = await supabaseInstance.from('profiles').select('*').eq('id', userId).single();
      if (data) setProfile(data);
    } catch (e) {
      console.error("Error fetching profile", e);
    }
  };

  const fetchTasks = async () => {
    if (!supabaseInstance) return;
    try {
      let query = supabaseInstance.from('tasks').select('*');
      if (profile?.role !== 'admin') {
        query = query.eq('assigned_to', session.user.id);
      }
      const { data } = await query.order('created_at', { ascending: false });
      if (data) setTasks(data);
    } catch (e) {
      console.error("Error fetching tasks", e);
    }
  };

  const fetchPartners = async () => {
    if (!supabaseInstance) return;
    try {
      const { data } = await supabaseInstance.from('profiles').select('*');
      if (data) setPartners(data);
    } catch (e) {
      console.error("Error fetching partners", e);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!supabaseInstance) return alert("System not ready.");
    
    setLoading(true);
    try {
      if (authMode === 'signup') {
        const { error } = await supabaseInstance.auth.signUp({
          email: authData.email,
          password: authData.password,
          options: { data: { name: authData.name } }
        });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
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

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!supabaseInstance) return;
    const { error } = await supabaseInstance.from('tasks').insert([{
      ...newTask,
      status: 'Pending'
    }]);
    if (!error) {
      setIsAddingTask(false);
      fetchTasks();
    }
  };

  const toggleStatus = async (task) => {
    if (!supabaseInstance) return;
    const statusMap = { 'Pending': 'In Progress', 'In Progress': 'Completed', 'Completed': 'Pending' };
    const { error } = await supabaseInstance
      .from('tasks')
      .update({ status: statusMap[task.status] })
      .eq('id', task.id);
    if (!error) fetchTasks();
  };

  const deleteTask = async (id) => {
    if (!supabaseInstance) return;
    const { error } = await supabaseInstance.from('tasks').delete().eq('id', id);
    if (!error) fetchTasks();
  };

  // --- CALCULATED VALUES ---
  const isAdmin = profile?.role === 'admin';
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

  // --- RENDER LOGIC ---
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (errorMsg && !session) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl max-w-md">
            <ShieldCheck className="w-16 h-16 text-indigo-600 mx-auto mb-6" />
            <h2 className="text-2xl font-black text-slate-900 mb-4 uppercase">System Restricted</h2>
            <p className="text-slate-500 font-medium mb-6">{errorMsg}</p>
            <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl">Environment detected as restricted. Access via production URL for full functionality.</p>
        </div>
    </div>
  )

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md border border-white">
        <div className="flex justify-center mb-8">
          <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-100">
            <ShieldCheck className="text-white w-8 h-8" />
          </div>
        </div>
        <h2 className="text-3xl font-black text-center text-slate-900 mb-2 uppercase tracking-tighter">
          {authMode === 'login' ? 'Welcome Back' : 'Join TaskFlow'}
        </h2>
        <p className="text-center text-slate-400 font-bold mb-10">Access your project environment</p>
        
        <form onSubmit={handleAuth} className="space-y-5">
          {authMode === 'signup' && (
            <div className="relative">
              <User className="absolute left-4 top-4 text-slate-300" size={20} />
              <input 
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none font-bold transition-all"
                placeholder="Full Name"
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
              onChange={e => setAuthData({...authData, email: e.target.value})}
            />
          </div>
          <div className="relative">
            <Key className="absolute left-4 top-4 text-slate-300" size={20} />
            <input 
              type="password"
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none font-bold transition-all"
              placeholder="Password"
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <nav className="fixed bottom-0 w-full bg-white border-t md:top-0 md:left-0 md:w-64 md:h-full md:border-r md:border-t-0 p-4 z-50 shadow-2xl md:shadow-none">
        <div className="flex flex-col h-full">
          <div className="hidden md:flex items-center gap-3 mb-10 px-2">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-100">
              <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <span className="font-black text-2xl tracking-tighter text-indigo-950 uppercase">TaskFlow</span>
          </div>

          <div className="flex md:flex-col gap-2 justify-around md:justify-start flex-1">
            <NavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20}/>} label="Dashboard" />
            <NavItem active={view === 'tasks'} onClick={() => setView('tasks')} icon={<ListTodo size={20}/>} label={isAdmin ? "Full Project" : "My Work"} />
            {isAdmin && <NavItem active={view === 'partners'} onClick={() => setView('partners')} icon={<Users size={20}/>} label="Team" />}
          </div>

          <div className="hidden md:block mt-auto space-y-3">
            <div className="p-4 bg-white border border-slate-100 rounded-[1.5rem] flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black shrink-0">
                {profile?.name?.[0] || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate text-slate-900">{profile?.name || 'User'}</p>
                <p className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">{profile?.role || 'Partner'}</p>
              </div>
            </div>
            <button 
              onClick={() => supabaseInstance?.auth.signOut()}
              className="flex items-center gap-3 px-4 py-3 w-full rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all font-bold text-sm"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="pb-24 md:pb-8 md:pl-72 p-6 pt-10 max-w-7xl mx-auto">
        <header className="flex justify-between items-end mb-10">
          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase mb-2">{view}</h1>
            <p className="text-slate-400 font-semibold text-lg">{isAdmin ? 'Administrative Terminal' : 'Personal Workspace'}</p>
          </div>
          {view === 'tasks' && isAdmin && (
            <button onClick={() => setIsAddingTask(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 shadow-xl shadow-indigo-100 font-black uppercase text-xs tracking-widest">
              <Plus size={18} /> New Task
            </button>
          )}
        </header>

        {view === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <StatCard label="Scope Total" value={stats.total} icon={<ListTodo className="text-indigo-500" />} />
              <StatCard label="Active" value={stats.total - stats.completed} icon={<Clock className="text-amber-500" />} />
              <StatCard label="Finished" value={stats.completed} icon={<CheckCircle2 className="text-emerald-500" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ChartWrapper title="Status Distribution" icon={<PieIcon size={18}/>}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.statusData} innerRadius={70} outerRadius={90} paddingAngle={8} dataKey="value">
                      {stats.statusData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </ChartWrapper>
            </div>
          </div>
        )}

        {view === 'tasks' && (
          <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-100">
                  <tr>
                    <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Assignment</th>
                    <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Deadline</th>
                    <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">State</th>
                    {isAdmin && <th className="px-10 py-6 text-right">Ops</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tasks.map(task => (
                    <tr key={task.id} className="hover:bg-indigo-50/20 transition-all group">
                      <td className="px-10 py-6">
                        <div className="font-black text-slate-900 text-lg mb-1">{task.title}</div>
                        <div className="flex items-center gap-2">
                          <Tag size={12} className="text-indigo-400" />
                          <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">{task.project}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-sm text-slate-500 font-bold">{task.due_date}</td>
                      <td className="px-10 py-6">
                        <button onClick={() => toggleStatus(task)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                          task.status === 'Completed' ? 'bg-emerald-500 text-white border-emerald-600' : 
                          task.status === 'In Progress' ? 'bg-amber-400 text-amber-950 border-amber-500' : 'bg-white text-slate-400 border-slate-200'
                        }`}>
                          {task.status}
                        </button>
                      </td>
                      {isAdmin && (
                        <td className="px-10 py-6 text-right">
                          <button onClick={() => deleteTask(task.id)} className="p-2 text-slate-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100">
                            <Trash2 size={20} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'partners' && isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partners.map(p => (
              <div key={p.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-lg relative group">
                <div className="flex items-center gap-5 mb-6">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center text-2xl font-black text-white shadow-xl shadow-indigo-100">{p.name?.[0]}</div>
                  <div>
                    <h3 className="font-black text-xl text-slate-900">{p.name}</h3>
                    <p className="text-sm font-semibold text-slate-400">{p.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Admin Task Modal */}
      {isAddingTask && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-xl shadow-2xl relative">
            <button onClick={() => setIsAddingTask(false)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 transition-all"><X size={32} /></button>
            <h2 className="text-4xl font-black mb-10 text-slate-900 tracking-tighter uppercase">New Task</h2>
            <form onSubmit={handleAddTask} className="space-y-6">
              <Input label="Task Title" required onChange={e => setNewTask({...newTask, title: e.target.value})} placeholder="Maintenance check..." />
              <Input label="Project Category" onChange={e => setNewTask({...newTask, project: e.target.value})} placeholder="Alpha Rig" />
              <div className="grid grid-cols-2 gap-6">
                <Input type="date" label="Deadline" required onChange={e => setNewTask({...newTask, due_date: e.target.value})} />
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assignee</label>
                  <select className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 font-bold outline-none" onChange={e => setNewTask({...newTask, assigned_to: e.target.value})}>
                    <option value="">Select Partner</option>
                    {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <button className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Create Task</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// UI Components
const NavItem = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}>
    {icon} <span className="hidden md:inline">{label}</span>
  </button>
);

const StatCard = ({ label, value, icon }) => (
  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 flex items-center justify-between hover:shadow-2xl transition-all duration-500 group border-b-4 border-b-transparent hover:border-b-indigo-500">
    <div>
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">{label}</p>
      <p className="text-4xl font-black text-slate-900 tracking-tighter">{value}</p>
    </div>
    <div className="bg-slate-50 p-5 rounded-[1.5rem] group-hover:bg-indigo-50 transition-all">{icon}</div>
  </div>
);

const ChartWrapper = ({ title, icon, children, className }) => (
  <div className={`bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm ${className}`}>
    <div className="flex items-center gap-3 mb-10">
      <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">{icon}</div>
      <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">{title}</h3>
    </div>
    <div className="h-[320px] w-full">{children}</div>
  </div>
);

const Input = ({ label, ...props }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
    <input {...props} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none transition-all text-sm font-bold" />
  </div>
);

export default App;