import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  PiggyBank,
  Settings,
  Monitor,
  Smartphone,
  Laptop,
  LogOut,
  Activity,
  Receipt,
  CheckCircle2,
  X,
  Trash2,
  Download,
  ArrowRight,
  Shield,
  Brain,
  Share,
  PlusSquare,
} from 'lucide-react'
import { auth, db } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import {
  doc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  setDoc,
  getDoc,
} from './services/backendFirestore.js'
import Dashboard from './features/dashboard/Dashboard'
import Budgeting from './features/budget/Budgeting'
import DebtControl from './features/debt/DebtControl'
import Savings from './features/savings/Savings'
import Auth from './features/auth/Auth'
import Onboarding from './features/onboarding/Onboarding'
import Income from './features/income/Income'
import Expenses from './features/expenses/Expenses'
import ErrorBoundary from './features/errorBoundary/ErrorBoundary'
import { startSession, endSession, trackEvent } from './lib/analytics'

const getDeviceInfo = () => {
  const ua = navigator.userAgent
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua)
  const isMac = /Macintosh/i.test(ua) && !isMobile
  const isPc = /Windows|Linux/i.test(ua) && !isMobile

  if (isMobile) return { type: 'Mobile', icon: Smartphone }
  if (isMac) return { type: 'Mac', icon: Laptop }
  if (isPc) return { type: 'PC', icon: Monitor }
  return { type: 'PC', icon: Monitor }
}

const RichGoalsLogo = ({ size = 40, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <ellipse
      cx="50"
      cy="50"
      rx="45"
      ry="12"
      transform="rotate(45 50 50)"
      fill="currentColor"
      className="text-blue-500"
    />
    <ellipse
      cx="50"
      cy="50"
      rx="45"
      ry="12"
      transform="rotate(-45 50 50)"
      fill="currentColor"
    />
    <circle cx="50" cy="50" r="10" fill="currentColor" fillOpacity="0.5" />
  </svg>
)

function App() {
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [device] = useState(getDeviceInfo)
  const [loading, setLoading] = useState(true)
  const [userDocReady, setUserDocReady] = useState(false)
  const [authScreenEpoch, setAuthScreenEpoch] = useState(0)

  const [userData, setUserData] = useState(null)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const logoutInProgressRef = useRef(false)
  const refreshInFlightRef = useRef(false)

  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())
  const isStandalone = 'standalone' in window.navigator && window.navigator.standalone
  const shouldShowInstallHint = isIos && !isStandalone

  useEffect(() => {
    const lastVersionSeen = localStorage.getItem('richgoals_version_seen')
    if (lastVersionSeen !== '2.0' && user) {
      const timer = setTimeout(() => setIsUpdateModalOpen(true), 0)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [user])

  const refreshUserData = useCallback(async (targetUser = user, options = {}) => {
    if (!targetUser?.uid) return

    const { silent = true } = options

    if (refreshInFlightRef.current) {
      if (!silent) {
        setUserDocReady(true)
        setLoading(false)
      }
      return
    }

    refreshInFlightRef.current = true

    try {
      if (!silent) {
        setLoading(true)
        setUserDocReady(false)
      }

      const userRef = doc(db, 'users', targetUser.uid)
      const docSnap = await getDoc(userRef)

      if (docSnap.exists()) {
        setUserData(docSnap.data())
      } else {
        const newUserData = {
          name: targetUser.displayName || 'Usuario',
          email: targetUser.email,
          photoURL: targetUser.photoURL,
          createdAt: new Date().toISOString(),
        }

        await setDoc(userRef, newUserData)
        setUserData(newUserData)
      }

      if (!userDocReady) {
        setUserDocReady(true)
      }
    } catch (err) {
      console.error('Error refreshing user document:', err)

      if (!silent) {
        alert('Error conectando con la base de datos.')
      }
    } finally {
      refreshInFlightRef.current = false

      if (!silent) {
        setLoading(false)
      }
    }
  }, [user, userDocReady])

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)

      if (currentUser) {
        logoutInProgressRef.current = false
        setLoading(true)
        setUserDocReady(false)
        startSession(currentUser.uid)
        await refreshUserData(currentUser, { silent: false })
      } else {
        setUserData(null)
        setUserDocReady(true)

        if (logoutInProgressRef.current) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setAuthScreenEpoch((prev) => prev + 1)
              setLoading(false)
            })
          })
        } else {
          setLoading(false)
        }
      }
    })

    return () => {
      unsubscribeAuth()
    }
  }, [refreshUserData])

  const prevTab = useRef(activeTab)
  useEffect(() => {
    if (prevTab.current !== activeTab) {
      trackEvent('tab_view', { tab: activeTab })
      prevTab.current = activeTab
    }
  }, [activeTab])

  const migration20Ran = useRef(false)
  useEffect(() => {
    const runMigration20 = async () => {
      if (!user || !userData) return
      if (userData.appVersion === '2.0' || migration20Ran.current) return

      migration20Ran.current = true

      await new Promise((r) => setTimeout(r, 2000))

      if (userData.appVersion === '2.0') return

      const userRef = doc(db, 'users', user.uid)

      const payload = {
        migrationDone: '2.0',
        appVersion: '2.0',
        age: userData.age || 25,
        setupComplete: true,
      }

      if (!userData.nickname) {
        const fullName = userData.name || user.displayName || ''
        payload.nickname = fullName.split(' ')[0] || 'Usuario'
      }

      try {
        await updateDoc(userRef, payload)
        await refreshUserData(user, { silent: true })
        console.log('Migration 2.0 complete: version stamped and age initialized.')
      } catch (err) {
        console.error('Migration 2.0 failed', err)
        migration20Ran.current = false
      }
    }

    runMigration20()
  }, [user, userData, refreshUserData])

  const handleLogout = async () => {
    try {
      logoutInProgressRef.current = true
      setLoading(true)
      setIsSettingsOpen(false)
      setIsUpdateModalOpen(false)

      try {
        await endSession()
      } catch (err) {
        console.warn('endSession warning:', err)
      }

      setUserData(null)
      setUserDocReady(false)

      await signOut(auth)
    } catch (err) {
      console.error('Logout error:', err)
      logoutInProgressRef.current = false
      setLoading(false)
    }
  }

  const renderLoading = (text) => (
    <div key={`loading-${text}`} className="min-h-screen bg-aura-bg flex flex-col items-center justify-center gap-6">
      <RichGoalsLogo size={80} className="text-white animate-pulse" />
      <div className="font-black text-white text-xl tracking-tighter uppercase animate-bounce italic">
        {text}
      </div>
    </div>
  )

  if (loading) {
    return renderLoading('Iniciando RichGoals...')
  }

  if (!user) {
    return (
      <div key={`auth-shell-${authScreenEpoch}`}>
        <Auth key={`auth-${authScreenEpoch}`} />
      </div>
    )
  }

  if (user && !userDocReady) {
    return renderLoading('Cargando tu perfil...')
  }

  if (user && userDocReady && !userData?.setupComplete && !userData?.finances) {
    return (
      <div key={`onboarding-${user.uid}`}>
        <Onboarding user={user} onComplete={() => window.location.reload()} />
      </div>
    )
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard userData={userData} />
      case 'income':
        return <Income userData={userData} user={user} onDataChanged={refreshUserData} />
      case 'budget':
        return <Budgeting userData={userData} user={user} onDataChanged={refreshUserData} />
      case 'debt':
        return <DebtControl userData={userData} user={user} onDataChanged={refreshUserData} />
      case 'savings':
        return <Savings userData={userData} user={user} onDataChanged={refreshUserData} />
      case 'expenses':
        return <Expenses userData={userData} user={user} onDataChanged={refreshUserData} />
      default:
        return <Dashboard userData={userData} />
    }
  }

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Inicio' },
    { id: 'income', icon: Activity, label: 'Ingresos' },
    { id: 'budget', icon: Wallet, label: 'Presupuesto' },
    { id: 'debt', icon: TrendingUp, label: 'Deudas' },
    { id: 'expenses', icon: Receipt, label: 'Gastos', isDanger: true },
    { id: 'savings', icon: PiggyBank, label: 'Capital' },
  ]

  return (
    <ErrorBoundary>
      <div key={`app-shell-${user?.uid || 'guest'}`} className="flex bg-aura-bg text-aura-text font-sans h-screen overflow-hidden">
        <aside className="hidden md:flex flex-col w-64 border-r border-aura-border glass-card rounded-none z-50">
          <div className="p-6 flex items-center gap-3 border-b border-aura-border/50">
            <RichGoalsLogo size={32} className="text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
            <h1 className="text-xl font-bold tracking-tight">
              Rich<span className="text-blue-500">Goals</span>
            </h1>
          </div>

          <nav className="flex-1 p-4 space-y-2 mt-4">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id

              let baseColor = 'text-aura-muted hover:text-white hover:bg-white/5'
              let activeColor = 'bg-aura-primary/10 text-aura-primary shadow-[inset_0_0_10px_rgba(0,255,196,0.1)]'

              if (item.id === 'income') {
                baseColor = 'text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/5'
                activeColor = 'bg-blue-500/10 text-blue-400 shadow-[inset_0_0_10px_rgba(59,130,246,0.15)]'
              } else if (item.id === 'budget') {
                baseColor = 'text-purple-400/60 hover:text-purple-400 hover:bg-purple-500/5'
                activeColor = 'bg-purple-500/10 text-purple-400 shadow-[inset_0_0_10px_rgba(168,85,247,0.15)]'
              } else if (item.id === 'debt') {
                baseColor = 'text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/5'
                activeColor = 'bg-amber-500/10 text-amber-400 shadow-[inset_0_0_10px_rgba(234,179,8,0.15)]'
              } else if (item.id === 'expenses') {
                baseColor = 'text-red-400/60 hover:text-red-400 hover:bg-red-500/5'
                activeColor = 'bg-red-500/10 text-red-400 shadow-[inset_0_0_10px_rgba(239,68,68,0.15)]'
              } else if (item.id === 'savings') {
                baseColor = 'text-green-400/60 hover:text-green-400 hover:bg-green-500/5'
                activeColor = 'bg-green-500/10 text-green-400 shadow-[inset_0_0_10px_rgba(34,197,94,0.15)]'
              } else if (item.id === 'dashboard') {
                baseColor = 'text-aura-muted hover:text-white hover:bg-white/5'
                activeColor = 'bg-white/10 text-white shadow-[inset_0_0_10px_rgba(255,255,255,0.1)]'
              }

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive ? activeColor : baseColor}`}
                >
                  <Icon size={20} />
                  <span className="font-semibold">{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="p-4 border-t border-aura-border/50 space-y-2">
            <button
              onClick={() => setIsUpdateModalOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-blue-400 hover:text-white hover:bg-blue-900/30 transition-all duration-300 relative group"
            >
              <div className="text-blue-400 group-hover:text-blue-300">
                <RichGoalsLogo size={20} className="animate-pulse" />
              </div>
              <span className="font-semibold text-[10px] uppercase tracking-widest">Novedades</span>
              <div className="absolute right-4 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-aura-muted hover:text-white hover:bg-white/5 transition-all duration-300"
            >
              <Settings size={20} />
              <span className="font-semibold text-[10px] uppercase tracking-widest">Ajustes</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all duration-300"
            >
              <LogOut size={20} />
              <span className="font-semibold text-sm uppercase tracking-widest">Salir</span>
            </button>
          </div>
        </aside>

        <div className="flex-1 w-full flex flex-col h-screen overflow-hidden relative">
          <header className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-aura-border glass-card rounded-none md:bg-transparent md:border-none sticky top-0 z-50 w-full">
            <div className="flex md:hidden items-center gap-3">
              <RichGoalsLogo size={28} className="text-white drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
              <h2 className="text-xl font-bold tracking-tight">
                Rich<span className="text-blue-500">Goals</span>
              </h2>
            </div>

            <div className="hidden md:block" />

            <div className="flex items-center gap-2">
              <button onClick={() => setIsUpdateModalOpen(true)} className="md:hidden p-2 rounded-full hover:bg-aura-card relative">
                <div className="text-blue-400">
                  <RichGoalsLogo size={20} />
                </div>
                <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,1)]" />
              </button>

              <button onClick={() => setIsSettingsOpen(true)} className="md:hidden p-2 rounded-full hover:bg-aura-card">
                <Settings size={20} className="text-aura-muted" />
              </button>

              <button onClick={handleLogout} className="md:hidden p-2 rounded-full hover:bg-aura-card">
                <LogOut size={20} className="text-aura-muted" />
              </button>
            </div>
          </header>

          <main className="flex-1 w-full overflow-y-auto overflow-x-hidden p-3 md:p-10 hide-scrollbar pb-28 md:pb-10">
            <div className="max-w-4xl mx-auto w-full min-w-0">
              <ErrorBoundary>
                {renderContent()}
              </ErrorBoundary>
            </div>
          </main>

          <nav
            className="md:hidden flex items-center justify-around pt-3 pb-safe glass-card rounded-t-3xl border-t border-aura-border fixed bottom-0 left-0 right-0 z-50 bg-aura-bg/95 backdrop-blur-xl px-safe"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id

              let mobileBaseColor = 'text-aura-muted'
              let mobileActiveColor = 'text-white'
              let indicatorColor = 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]'

              if (item.id === 'income') {
                mobileBaseColor = 'text-blue-400/50'
                mobileActiveColor = 'text-blue-400'
                indicatorColor = 'bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.8)]'
              } else if (item.id === 'budget') {
                mobileBaseColor = 'text-purple-400/50'
                mobileActiveColor = 'text-purple-400'
                indicatorColor = 'bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.8)]'
              } else if (item.id === 'debt') {
                mobileBaseColor = 'text-amber-400/50'
                mobileActiveColor = 'text-amber-400'
                indicatorColor = 'bg-amber-400 shadow-[0_0_6px_rgba(234,179,8,0.8)]'
              } else if (item.id === 'expenses') {
                mobileBaseColor = 'text-red-400/50'
                mobileActiveColor = 'text-red-400'
                indicatorColor = 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
              } else if (item.id === 'savings') {
                mobileBaseColor = 'text-green-400/50'
                mobileActiveColor = 'text-green-400'
                indicatorColor = 'bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.8)]'
              }

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 relative min-w-[52px] ${isActive ? mobileActiveColor : mobileBaseColor}`}
                >
                  {isActive && (
                    <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full ${indicatorColor}`} />
                  )}
                  <Icon size={22} className={`transition-all duration-200 mt-1 ${isActive ? 'scale-105' : 'opacity-60'}`} />
                  <span className={`text-[9px] font-bold tracking-tight uppercase transition-all ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                    {item.label}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>

        {isUpdateModalOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex flex-col items-center justify-center p-4">
            <div className="glass-card max-w-lg w-full flex flex-col p-6 sm:p-8 border-aura-border relative overflow-hidden animate-in zoom-in-95 duration-500 max-h-[90vh]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/15 rounded-full blur-[50px] -mr-10 -mt-10 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-900/40 rounded-full blur-[40px] -ml-8 -mb-8 pointer-events-none" />

              <div className="flex items-center gap-4 mb-6 shrink-0 relative z-10">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-700 to-blue-950 flex items-center justify-center text-white shadow-lg shadow-blue-900/50 border border-white/10 shrink-0">
                  <RichGoalsLogo size={28} />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white italic tracking-tighter">RichGoals V2.0</h2>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 hide-scrollbar space-y-5 mb-6 text-aura-muted leading-relaxed relative z-10 pr-2">
                <p>
                  {userData?.nickname ? `${userData.nickname}, esta` : 'Esta'} versión trae mejoras integrales en toda tu experiencia financiera:
                </p>

                <div className="bg-white/5 border border-white/5 p-5 rounded-xl space-y-4">
                  <div className="flex gap-3 text-sm items-start">
                    <div className="p-1.5 rounded-lg bg-blue-500/10 shrink-0 mt-0.5">
                      <LayoutDashboard size={14} className="text-blue-400" />
                    </div>
                    <p><span className="text-white font-bold">Inicio Renovado:</span> Vistazo rápido y sin ruido visual, enfocado solo en lo que realmente importa.</p>
                  </div>

                  <div className="flex gap-3 text-sm items-start">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 shrink-0 mt-0.5">
                      <Activity size={14} className="text-emerald-400" />
                    </div>
                    <p><span className="text-white font-bold">Flujo Dinámico:</span> Registro de ingresos y gastos más ágil, con navegación unificada e intuitiva.</p>
                  </div>

                  <div className="flex gap-3 text-sm items-start">
                    <div className="p-1.5 rounded-lg bg-purple-500/10 shrink-0 mt-0.5">
                      <Wallet size={14} className="text-purple-400" />
                    </div>
                    <p><span className="text-white font-bold">Control de Flujo:</span> Integración perfecta entre Presupuestos, Deudas y el Cash Flow Disponible (CFD).</p>
                  </div>

                  <div className="flex gap-3 text-sm items-start">
                    <div className="p-1.5 rounded-lg bg-slate-500/20 shrink-0 mt-0.5">
                      <Brain size={14} className="text-slate-400" />
                    </div>
                    <p><span className="text-white font-bold">Rich Insights:</span> Tu asesor personal que escaneará tu contexto financiero para darte consejos estratégicos vitales.</p>
                  </div>
                </div>

                {shouldShowInstallHint && (
                  <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex flex-col gap-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-xl -mr-10 -mt-10 pointer-events-none" />
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                        <ArrowRight size={18} className="rotate-90" />
                      </div>
                      <div className="flex-1">
                        <span className="text-white font-bold text-sm block">Instala RichGoals App</span>
                        <span className="text-xs text-blue-200">Para pantalla completa y acceso rápido en iPhone.</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/80 bg-black/30 w-fit px-3 py-1.5 rounded-lg border border-white/5 relative z-10">
                      <span>Toca</span>
                      <Share size={14} className="text-blue-400" />
                      <span>y <b>Agregar a inicio</b></span>
                      <PlusSquare size={14} className="text-blue-400 ml-1" />
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setIsUpdateModalOpen(false)
                  localStorage.setItem('richgoals_version_seen', '2.0')
                }}
                className="w-full bg-blue-700 hover:bg-blue-600 text-white border border-blue-500/50 rounded-xl sm:py-4 py-3 text-base sm:text-lg font-black tracking-tighter shadow-[0_0_20px_rgba(37,99,235,0.3)] group flex items-center justify-center gap-2 transition-all shrink-0 mt-2 relative z-10"
              >
                ENTRAR A LA APP
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {isSettingsOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-6">
            <div className="glass-card max-w-md w-full p-8 border-aura-border relative animate-in slide-in-from-bottom-5 duration-300">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="absolute top-4 right-4 p-2 text-aura-muted hover:text-white transition-colors"
                title="Cerrar"
              >
                <X size={20} />
              </button>

              <h3 className="text-2xl font-black text-white mb-6 italic">Configuración</h3>

              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-aura-muted uppercase tracking-widest block mb-4">
                    Manejo de Datos
                  </label>

                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        const backup = { ...userData }
                        const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backup, null, 2))}`
                        const a = document.createElement('a')
                        a.href = dataStr
                        a.download = 'richgoals_backup.json'
                        document.body.appendChild(a)
                        a.click()
                        a.remove()
                      }}
                      className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all text-white font-bold text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <Download size={18} className="text-green-400" />
                        Exportar Todo (JSON)
                      </div>
                      <ArrowRight size={16} className="opacity-50" />
                    </button>

                    <button
                      onClick={async () => {
                        if (confirm('🚨 ¡ALERTA! Esto borrará absolutamente todos tus datos registrados. Esta acción no se puede deshacer. ¿Estás seguro?')) {
                          try {
                            const collectionsToReset = ['incomes', 'expenses', 'debts', 'savings']
                            for (const collName of collectionsToReset) {
                              const q = query(collection(db, collName), where('userId', '==', user.uid))
                              const snap = await getDocs(q)
                              const deletePromises = snap.docs.map((d) => deleteDoc(doc(db, collName, d.id)))
                              await Promise.all(deletePromises)
                            }
                            alert('Hard Reset Completo. Tu cuenta está limpia.')
                            window.location.reload()
                          } catch (err) {
                            alert(`Error al resetear: ${err.message}`)
                          }
                        }
                      }}
                      className="w-full flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all text-red-400 font-bold text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <Trash2 size={18} />
                        Hard Reset (Borrar Todo)
                      </div>
                    </button>
                  </div>

                  <div className="pt-6 border-t border-white/5 space-y-4 mt-6">
                    <h4 className="text-[10px] font-black text-aura-muted uppercase tracking-[0.2em] flex items-center gap-2">
                      <Shield size={12} className="text-aura-primary" />
                      Privacidad y Datos
                    </h4>

                    <div className="bg-white/3 border border-white/5 rounded-xl p-4 space-y-3">
                      <p className="text-[11px] text-white/50 leading-relaxed">
                        <span className="text-white/70 font-bold">Tus datos son tuyos.</span> RichGoals opera bajo estos principios:
                      </p>

                      <ul className="space-y-2 text-[10px] text-white/40">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={10} className="text-emerald-500 shrink-0 mt-0.5" />
                          No vendemos, compartimos ni exponemos tu información financiera.
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={10} className="text-emerald-500 shrink-0 mt-0.5" />
                          Tus datos se almacenan cifrados en Firebase (Google Cloud).
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={10} className="text-emerald-500 shrink-0 mt-0.5" />
                          Solo recolectamos métricas de uso agregadas y anónimas.
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={10} className="text-emerald-500 shrink-0 mt-0.5" />
                          Puedes exportar o eliminar todo en cualquier momento.
                        </li>
                      </ul>

                      <p className="text-[9px] text-white/25 italic pt-1">
                        Nuestro objetivo es darte paz financiera y maximizar tu prosperidad.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex flex-col items-center">
                  <RichGoalsLogo size={32} className="opacity-50 mb-2" />
                  <p className="text-[10px] font-bold text-aura-muted uppercase tracking-[0.3em]">
                    V2.0 · Build 11/03/2026
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App