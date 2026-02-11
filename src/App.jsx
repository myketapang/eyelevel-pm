import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  CheckCircle2, 
  Clock, 
  ListTodo, 
  Plus, 
  LogOut, 
  ShieldCheck, 
  Trash2,
  Calendar,
  Tag,
  Users,
  PieChart as PieIcon,
  X,
  Mail,
  ChevronRight,
  AlertCircle,
  BarChart3,
  Briefcase,
  UserPlus,
  Lock,
  Menu
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
  const [isAddingPartner, setIsAddingPartner] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', project: 'General', assigned_to: '', due_date: '' });
  const [newPartner, setNewPartner] = useState({ name: '', email: '', password: '' });

  // --- ROLE-BASED ACCESS CONTROL ---
  const isAdmin = profile?.role === 'admin';

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
        } catch (e) {
          url = window.VITE_SUPABASE_URL || '';
          key = window.VITE_SUPABASE_ANON_KEY || '';
        }

        if (!url || !key) {
          if (isMounted) {
            setErrorMsg("Supabase credentials missing. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.");
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
            if (session) {
              fetchProfile(session.user.id);
            } else {
              setProfile(null);
              setTasks([]);
              setPartners([]);
            }
          }
        });

        return () => subscription.unsubscribe();
      } catch (err) {
        console.error('Initialization error:', err);
        if (isMounted) {
          setErrorMsg("Failed to initialize database connection: " + err.message);
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
      script.onerror = () => {
        if (isMounted) {
          setErrorMsg("Failed to load Supabase SDK from CDN.");
          setLoading(false);
        }
      };
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
      if (profile.role === 'admin') {
        fetchPartners();
      }
    }
  }, [session, profile]);

  // --- DB HELPERS ---
  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabaseInstance
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      if (data) setProfile(data);
    } catch (err) {
      console.error("Error fetching profile:", err);
      if (err.code === 'PGRST116') {
        try {
          const user = await supabaseInstance.auth.getUser();
          const { data: newProfile, error: insertError } = await supabaseInstance
            .from('profiles')
            .insert([{
              id: userId,
              name: user.data.user?.user_metadata?.name || 'User',
              email: user.data.user?.email,
              role: 'partner'
            }])
            .select()
            .single();
          
          if (!insertError && newProfile) {
            setProfile(newProfile);
          }
        } catch (insertErr) {
          console.error("Error creating profile:", insertErr);
        }
      }
    }
  };

  const fetchTasks = async () => {
    try {
      let query = supabaseInstance.from('tasks').select('*');
      
      // CRITICAL: Role-based data scoping
      // Partners ONLY see tasks assigned to them
      // Admins see ALL tasks
      if (profile?.role === 'partner') {
        query = query.eq('assigned_to', session.user.id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setTasks([]);
    }
  };

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabaseInstance
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPartners(data || []);
    } catch (err) {
      console.error("Error fetching partners:", err);
      setPartners([]);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    try {
      const redirectUrl = window.location.origin;

      if (authMode === 'signup') {
        const { data, error } = await supabaseInstance.auth.signUp({
          email: authData.email,
          password: authData.password,
          options: { 
            data: { name: authData.name },
            emailRedirectTo: redirectUrl
          }
        });
        
        if (error) throw error;
        
        if (data?.user) {
          alert("Account created! Please check your email to verify your account.");
          setAuthMode('login');
          setAuthData({ email: '', password: '', name: '' });
        }
      } else {
        const { data, error } = await supabaseInstance.auth.signInWithPassword({
          email: authData.email,
          password: authData.password,
        });
        
        if (error) throw error;
      }
    } catch (err) {
      console.error('Auth error:', err);
      setErrorMsg(err.message);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskStatus = async (task) => {
    try {
      const statusOrder = ['Pending', 'In Progress', 'Completed'];
      const currentIndex = statusOrder.indexOf(task.status);
      const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
      
      const { error } = await supabaseInstance
        .from('tasks')
        .update({ status: nextStatus })
        .eq('id', task.id);
      
      if (error) throw error;
      
      await fetchTasks();
    } catch (err) {
      console.error('Error updating task:', err);
      alert("Failed to update task status: " + err.message);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    
    if (!isAdmin) {
      alert("Only admins can create tasks");
      return;
    }
    
    try {
      const taskData = {
        title: newTask.title,
        project: newTask.project || 'General',
        assigned_to: newTask.assigned_to || null,
        due_date: newTask.due_date || null,
        created_by: session.user.id,
        status: 'Pending'
      };
      
      const { error } = await supabaseInstance
        .from('tasks')
        .insert([taskData]);
      
      if (error) throw error;
      
      setIsAddingTask(false);
      setNewTask({ title: '', project: 'General', assigned_to: '', due_date: '' });
      await fetchTasks();
      alert('Task created successfully!');
    } catch (err) {
      console.error('Error creating task:', err);
      alert("Failed to create task: " + err.message);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!isAdmin) {
      alert("Only admins can delete tasks");
      return;
    }
    
    if (!confirm("Are you sure you want to delete this task?")) return;
    
    try {
      const { error } = await supabaseInstance
        .from('tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
      
      await fetchTasks();
      alert('Task deleted successfully!');
    } catch (err) {
      console.error('Error deleting task:', err);
      alert("Failed to delete task: " + err.message);
    }
  };

  const handleAddPartner = async (e) => {
    e.preventDefault();
    
    if (!isAdmin) {
      alert("Only admins can add partners");
      return;
    }
    
    try {
      const { data: authData, error: authError } = await supabaseInstance.auth.signUp({
        email: newPartner.email,
        password: newPartner.password,
        options: {
          data: { name: newPartner.name },
          emailRedirectTo: window.location.origin
        }
      });
      
      if (authError) throw authError;
      
      setIsAddingPartner(false);
      setNewPartner({ name: '', email: '', password: '' });
      
      setTimeout(async () => {
        await fetchPartners();
      }, 1000);
      
      alert('Partner added successfully! They will receive a verification email.');
    } catch (err) {
      console.error('Error adding partner:', err);
      alert("Failed to add partner: " + err.message);
    }
  };

  const handleRemovePartner = async (partnerId) => {
    if (!isAdmin) {
      alert("Only admins can remove partners");
      return;
    }
    
    if (!confirm("Are you sure you want to remove this partner? All their tasks will be deleted.")) return;
    
    try {
      const { error: tasksError } = await supabaseInstance
        .from('tasks')
        .delete()
        .eq('assigned_to', partnerId);
      
      if (tasksError) throw tasksError;
      
      const { error: profileError } = await supabaseInstance
        .from('profiles')
        .delete()
        .eq('id', partnerId);
      
      if (profileError) throw profileError;
      
      await fetchPartners();
      await fetchTasks();
      alert('Partner removed successfully!');
    } catch (err) {
      console.error('Error removing partner:', err);
      alert("Failed to remove partner: " + err.message);
    }
  };

  const getPartnerName = (partnerId) => {
    const partner = partners.find(p => p.id === partnerId);
    return partner?.name || 'Unassigned';
  };

  // --- STATS (Context-aware based on accessible tasks) ---
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const pending = tasks.filter(t => t.status === 'Pending').length;
    
    const statusData = [
      { name: 'Pending', value: pending },
      { name: 'In Progress', value: inProgress },
      { name: 'Completed', value: completed },
    ].filter(item => item.value > 0);

    const projectAgg = tasks.reduce((acc, task) => {
      if (!acc[task.project]) acc[task.project] = { name: task.project, total: 0, done: 0 };
      acc[task.project].total += 1;
      if (task.status === 'Completed') acc[task.project].done += 1;
      return acc;
    }, {});

    const projectProgressData = Object.values(projectAgg).map(p => ({
      name: p.name,
      progress: Math.round((p.done / (p.total || 1)) * 100),
      label: `${p.done}/${p.total} Done`
    }));

    const partnerData = isAdmin ? partners.map(p => {
      const partnerTasks = tasks.filter(t => t.assigned_to === p.id);
      return { name: p.name, tasks: partnerTasks.length };
    }) : [];
    
    return {
      total,
      completed,
      inProgress,
      pending,
      statusData,
      projectProgressData,
      partnerData
    };
  }, [tasks, partners, isAdmin]);

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-2xl max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl sm:text-2xl font-black mb-2 uppercase tracking-tight text-slate-900">Configuration Error</h2>
          <p className="text-sm sm:text-base text-slate-600 mb-4">{errorMsg}</p>
          <p className="text-xs text-slate-400 font-bold">Please check your environment variables and try again.</p>
        </div>
      </div>
    );
  }

  // --- AUTH SCREEN ---
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50 p-4 sm:p-6">
        <div className="bg-white p-8 sm:p-12 rounded-3xl shadow-2xl w-full max-w-md border border-slate-100">
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-indigo-600 rounded-2xl mb-4 sm:mb-6 shadow-xl shadow-indigo-200">
              <ShieldCheck className="text-white" size={32} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase mb-2 text-slate-900">TaskFlow</h1>
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Project Management System</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 sm:space-y-5">
            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Full Name</label>
                <input 
                  className="w-full p-3 sm:p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold outline-none text-sm sm:text-base" 
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
                className="w-full p-3 sm:p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold outline-none text-sm sm:text-base" 
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
                className="w-full p-3 sm:p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold outline-none text-sm sm:text-base" 
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
              className="w-full py-3 sm:py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setAuthData({ email: '', password: '', name: '' });
                setErrorMsg('');
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
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-40 safe-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <ShieldCheck className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-base font-black uppercase">TaskFlow</h1>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                {isAdmin ? 'ADMIN' : 'PARTNER'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => supabaseInstance?.auth.signOut()}
            className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <nav className="hidden lg:flex w-80 bg-white border-r border-slate-100 p-8 flex-col fixed h-screen overflow-y-auto">
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
            <NavItem 
              active={view === 'dashboard'} 
              onClick={() => setView('dashboard')} 
              icon={<LayoutDashboard size={20}/>} 
              label="Dashboard" 
            />
            <NavItem 
              active={view === 'tasks'} 
              onClick={() => setView('tasks')} 
              icon={<ListTodo size={20}/>} 
              label={isAdmin ? "All Tasks" : "My Tasks"} 
            />
            
            {isAdmin && (
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-2">Admin Tools</p>
                <NavItem 
                  active={view === 'partners'} 
                  onClick={() => setView('partners')} 
                  icon={<Users size={20}/>} 
                  label="Team Management" 
                />
              </div>
            )}
          </div>

          <div className="mt-auto pt-6 border-t border-slate-100">
            <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black shrink-0">
                {profile?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate">{profile?.name || 'User'}</p>
                <div className="flex items-center gap-1">
                  <p className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">{profile?.role || 'partner'}</p>
                  {!isAdmin && <Lock size={10} className="text-slate-400" />}
                </div>
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

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-40 safe-bottom">
          <div className="flex items-center justify-around px-2 py-2">
            <button
              onClick={() => setView('dashboard')}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl flex-1 transition-all ${
                view === 'dashboard' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'
              }`}
            >
              <LayoutDashboard size={20} />
              <span className="text-[10px] font-bold">Home</span>
            </button>
            <button
              onClick={() => setView('tasks')}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl flex-1 transition-all ${
                view === 'tasks' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'
              }`}
            >
              <ListTodo size={20} />
              <span className="text-[10px] font-bold">Tasks</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setView('partners')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl flex-1 transition-all ${
                  view === 'partners' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'
                }`}
              >
                <Users size={20} />
                <span className="text-[10px] font-bold">Team</span>
              </button>
            )}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 lg:ml-80 px-4 py-6 sm:px-6 lg:px-12 pb-24 lg:pb-12 max-w-7xl mx-auto w-full">
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 mb-8 sm:mb-12">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter uppercase mb-2">
                {view === 'dashboard' ? 'Overview' : view === 'tasks' ? (isAdmin ? 'All Tasks' : 'My Tasks') : 'Partners'}
              </h1>
              <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">
                {isAdmin 
                  ? (view === 'dashboard' ? 'Consolidated project metrics' : view === 'tasks' ? 'Full visibility of all deliverables' : 'Administer user access')
                  : (view === 'dashboard' ? 'Your personal performance metrics' : 'Tasks assigned to your profile')
                }
              </p>
            </div>
            
            <div className="flex gap-2">
              {view === 'tasks' && isAdmin && (
                <button 
                  onClick={() => setIsAddingTask(true)}
                  className="bg-indigo-600 text-white px-4 sm:px-8 py-3 sm:py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus size={18} />
                  <span className="hidden sm:inline">Create New Task</span>
                  <span className="sm:hidden">New Task</span>
                </button>
              )}
              {view === 'partners' && isAdmin && (
                <button 
                  onClick={() => setIsAddingPartner(true)}
                  className="bg-emerald-600 text-white px-4 sm:px-8 py-3 sm:py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 flex items-center gap-2 whitespace-nowrap"
                >
                  <UserPlus size={18} />
                  <span className="hidden sm:inline">Add Partner</span>
                  <span className="sm:hidden">Add</span>
                </button>
              )}
            </div>
          </header>

          {view === 'dashboard' && (
            <div className="space-y-6 sm:space-y-10">
              {/* Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                <StatCard 
                  label={isAdmin ? "Total Tasks" : "My Tasks"} 
                  value={stats.total} 
                  icon={<ListTodo className="text-indigo-500" />} 
                />
                <StatCard 
                  label="Active" 
                  value={stats.total - stats.completed} 
                  icon={<Clock className="text-amber-500" />} 
                />
                <StatCard 
                  label="Completed" 
                  value={stats.completed} 
                  icon={<CheckCircle2 className="text-emerald-500" />} 
                />
                <StatCard 
                  label={isAdmin ? "Team" : "Partners"} 
                  value={partners.length} 
                  icon={<Users className="text-blue-500" />} 
                />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                <ChartWrapper title={isAdmin ? "Task Status" : "My Status"} icon={<PieIcon size={18}/>}>
                  {stats.total > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={stats.statusData} 
                          innerRadius={60} 
                          outerRadius={80} 
                          paddingAngle={5} 
                          dataKey="value"
                        >
                          {stats.statusData.map((entry, i) => (
                            <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-slate-300 font-black uppercase tracking-widest text-xs">No tasks</p>
                    </div>
                  )}
                </ChartWrapper>

                <ChartWrapper title={isAdmin ? "Projects" : "My Projects"} icon={<Briefcase size={18}/>}>
                  {stats.projectProgressData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={stats.projectProgressData} margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={80} />
                        <Tooltip cursor={{fill: '#f8fafc'}} />
                        <Bar dataKey="progress" fill="#10b981" radius={[0, 4, 4, 0]} barSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-slate-300 font-black uppercase tracking-widest text-xs">No data</p>
                    </div>
                  )}
                </ChartWrapper>

                {isAdmin && stats.partnerData.length > 0 && (
                  <ChartWrapper title="Team Allocation" icon={<BarChart3 size={18}/>} className="lg:col-span-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.partnerData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: '#f8fafc'}} />
                        <Bar dataKey="tasks" fill="#6366f1" radius={[12, 12, 0, 0]} barSize={60} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartWrapper>
                )}
              </div>
            </div>
          )}

          {view === 'tasks' && (
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-b">
                    <tr>
                      <th className="px-4 sm:px-10 py-4 sm:py-8 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest">Task Details</th>
                      {isAdmin && <th className="hidden md:table-cell px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-widest">Assigned To</th>}
                      <th className="px-4 sm:px-10 py-4 sm:py-8 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Due</th>
                      <th className="px-4 sm:px-10 py-4 sm:py-8 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                      {isAdmin && (
                        <th className="px-4 sm:px-10 py-4 sm:py-8 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tasks.map(task => (
                      <tr key={task.id} className="hover:bg-indigo-50/20 transition-all group">
                        <td className="px-4 sm:px-10 py-4 sm:py-8">
                          <p className="text-base sm:text-xl font-black text-slate-900 mb-1 truncate max-w-xs">{task.title}</p>
                          <div className="flex items-center gap-2">
                            <Tag size={12} className="text-indigo-400" />
                            <span className="text-[9px] sm:text-[10px] font-black uppercase text-indigo-500 tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md truncate max-w-[100px]">
                              {task.project}
                            </span>
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="hidden md:table-cell px-10 py-8">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                {getPartnerName(task.assigned_to)[0]}
                              </div>
                              <span className="text-sm font-semibold text-slate-700">{getPartnerName(task.assigned_to)}</span>
                            </div>
                          </td>
                        )}
                        <td className="px-4 sm:px-10 py-4 sm:py-8 text-center">
                          <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-slate-500 font-medium">
                            <Calendar size={12} className="hidden sm:inline" />
                            <span className="truncate">{task.due_date || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-10 py-4 sm:py-8 text-right">
                          <button 
                            onClick={() => toggleTaskStatus(task)}
                            className={`px-2 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest border transition-all ${
                              task.status === 'Completed' ? 'bg-emerald-500 text-white border-emerald-600' : 
                              task.status === 'In Progress' ? 'bg-amber-400 text-white border-amber-500' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-400'
                            }`}
                          >
                            <span className="hidden sm:inline">{task.status}</span>
                            <span className="sm:hidden">{task.status.charAt(0)}</span>
                          </button>
                        </td>
                        {isAdmin && (
                          <td className="px-4 sm:px-10 py-4 sm:py-8 text-right">
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
                        <td colSpan={isAdmin ? "5" : "3"} className="px-4 sm:px-10 py-12 sm:py-20 text-center">
                          <p className="text-slate-300 font-black uppercase tracking-widest text-xs">
                            {isAdmin ? 'No tasks found' : 'No tasks assigned'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'partners' && isAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {partners.map(p => (
                <div key={p.id} className="bg-white p-6 sm:p-10 rounded-3xl border hover:shadow-xl transition-all group relative">
                  <button 
                    onClick={() => handleRemovePartner(p.id)}
                    className="absolute top-4 right-4 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={20} />
                  </button>
                  <div className="flex items-center gap-4 sm:gap-5 mb-6 sm:mb-8">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl sm:text-2xl font-black shadow-xl shadow-indigo-100 group-hover:scale-110 transition-transform">
                      {p.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight truncate">{p.name || 'User'}</h3>
                      <p className="text-xs font-black uppercase text-indigo-500 tracking-widest">{p.role || 'partner'}</p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-4 sm:pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-slate-400 text-xs sm:text-sm font-bold truncate">
                      <Mail size={14} /> <span className="truncate">{p.email}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="bg-slate-50 p-3 rounded-xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Tasks</p>
                        <p className="text-xl font-bold text-slate-900">{tasks.filter(t => t.assigned_to === p.id).length}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Joined</p>
                        <p className="text-sm font-bold text-slate-900">{p.created_at?.split('T')[0] || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {partners.length === 0 && (
                <div className="col-span-full text-center py-20">
                  <p className="text-slate-300 font-black uppercase tracking-widest text-xs">No team members</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Create Task Modal */}
      {isAddingTask && isAdmin && (
        <Modal title="Create New Task" onClose={() => setIsAddingTask(false)}>
          <form onSubmit={handleCreateTask} className="space-y-4 sm:space-y-6">
            <Input
              label="Task Title"
              type="text"
              required
              value={newTask.title}
              onChange={e => setNewTask({...newTask, title: e.target.value})}
              placeholder="Enter task title..."
            />

            <Input
              label="Project"
              type="text"
              value={newTask.project}
              onChange={e => setNewTask({...newTask, project: e.target.value})}
              placeholder="Project name..."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Due Date"
                type="date"
                value={newTask.due_date}
                onChange={e => setNewTask({...newTask, due_date: e.target.value})}
              />

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assign To</label>
                <select
                  value={newTask.assigned_to}
                  onChange={e => setNewTask({...newTask, assigned_to: e.target.value})}
                  className="w-full p-3 sm:p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold outline-none text-sm"
                >
                  <option value="">Select partner...</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsAddingTask(false);
                  setNewTask({ title: '', project: 'General', assigned_to: '', due_date: '' });
                }}
                className="flex-1 py-3 sm:py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 sm:py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all"
              >
                Create
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Partner Modal */}
      {isAddingPartner && isAdmin && (
        <Modal title="Add New Partner" onClose={() => setIsAddingPartner(false)}>
          <form onSubmit={handleAddPartner} className="space-y-4 sm:space-y-6">
            <Input
              label="Full Name"
              type="text"
              required
              value={newPartner.name}
              onChange={e => setNewPartner({...newPartner, name: e.target.value})}
              placeholder="Partner's full name"
            />

            <Input
              label="Email Address"
              type="email"
              required
              value={newPartner.email}
              onChange={e => setNewPartner({...newPartner, email: e.target.value})}
              placeholder="partner@example.com"
            />

            <Input
              label="Password"
              type="password"
              required
              value={newPartner.password}
              onChange={e => setNewPartner({...newPartner, password: e.target.value})}
              placeholder="••••••••"
            />

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsAddingPartner(false);
                  setNewPartner({ name: '', email: '', password: '' });
                }}
                className="flex-1 py-3 sm:py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 sm:py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all"
              >
                Add
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

// UI Components
const NavItem = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${
      active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
    }`}
  >
    {icon} <span>{label}</span>
    {active && <ChevronRight className="ml-auto opacity-50" size={16} />}
  </button>
);

const StatCard = ({ label, value, icon }) => (
  <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl border flex items-center justify-between hover:shadow-2xl transition-all duration-500 group">
    <div>
      <p className="text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-1 sm:mb-2">{label}</p>
      <p className="text-2xl sm:text-5xl font-black text-slate-900 tracking-tighter">{value}</p>
    </div>
    <div className="bg-slate-50 p-3 sm:p-6 rounded-xl sm:rounded-2xl group-hover:bg-indigo-50 transition-all">{icon}</div>
  </div>
);

const ChartWrapper = ({ title, icon, children, className }) => (
  <div className={`bg-white p-6 sm:p-10 rounded-3xl border shadow-sm ${className || ''}`}>
    <div className="flex items-center gap-3 mb-6 sm:mb-10">
      <div className="p-2 sm:p-3 bg-indigo-50 rounded-2xl text-indigo-600">{icon}</div>
      <h3 className="font-black text-slate-800 uppercase text-[10px] sm:text-xs tracking-widest">{title}</h3>
    </div>
    <div className="h-[250px] sm:h-[300px] w-full">{children}</div>
  </div>
);

const Modal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 sm:p-6 z-50">
    <div className="bg-white rounded-3xl p-6 sm:p-10 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter">{title}</h2>
        <button 
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-slate-100 transition-all"
        >
          <X size={24} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Input = ({ label, ...props }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <input 
      {...props} 
      className="w-full p-3 sm:p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold outline-none placeholder:text-slate-300 text-sm"
    />
  </div>
);

export default App;
