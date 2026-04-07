import React, { useEffect, useRef, useState } from 'react'
import { auth, db, googleProvider } from '../../firebase'
import { signInWithPopup } from 'firebase/auth'
import { doc, setDoc, getDoc } from '../../services/backendFirestore.js'
import { ArrowRight, Shield } from 'lucide-react'

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
            className="text-aura-primary"
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

const GoogleLogo = () => (
    <svg width="20" height="20" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
)

export default function Auth() {
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const mountedRef = useRef(false)
    const signingInRef = useRef(false)

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    const ensureUserDocument = async (user) => {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)

        if (!userSnap.exists()) {
            await setDoc(userRef, {
                name: user.displayName || 'Usuario Google',
                email: user.email || '',
                photoURL: user.photoURL || '',
                createdAt: new Date().toISOString(),
            })
        }
    }

    const handleGoogleSignIn = async () => {
        if (signingInRef.current) return

        signingInRef.current = true

        if (mountedRef.current) {
            setError('')
            setLoading(true)
        }

        try {
            const result = await signInWithPopup(auth, googleProvider)
            const user = result.user
            await ensureUserDocument(user)
        } catch (err) {
            console.error(err)

            if (!mountedRef.current) return

            if (err?.code === 'auth/popup-closed-by-user') {
                setError('Ventana cerrada. Inténtalo de nuevo.')
            } else if (err?.code === 'auth/cancelled-popup-request') {
                setError('Ya hay un intento de inicio de sesión en proceso.')
            } else if (err?.code === 'auth/popup-blocked') {
                setError('El navegador bloqueó la ventana emergente. Permite popups e inténtalo de nuevo.')
            } else {
                setError('Error al iniciar sesión. Inténtalo de nuevo.')
            }
        } finally {
            signingInRef.current = false
            if (mountedRef.current) {
                setLoading(false)
            }
        }
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-aura-bg p-6 relative overflow-hidden notranslate"
            translate="no"
        >
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-aura-primary/5 rounded-full blur-[150px] translate-x-48 -translate-y-48 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[120px] -translate-x-32 translate-y-32 pointer-events-none" />

            <div
                className="w-full max-w-md space-y-8 glass-card p-10 relative overflow-hidden border-aura-primary/20 shadow-[0_0_80px_rgba(0,255,196,0.08)] notranslate"
                translate="no"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-aura-primary/5 rounded-full blur-[100px] translate-x-32 -translate-y-32 pointer-events-none" />

                <div className="text-center relative z-10">
                    <RichGoalsLogo
                        size={72}
                        className="mx-auto mb-6 text-white drop-shadow-[0_0_15px_rgba(0,255,196,0.3)]"
                    />
                    <h1 className="text-4xl font-black text-white tracking-tighter">
                        Rich<span className="text-aura-primary">Goals</span>
                    </h1>
                    <p className="text-aura-muted mt-3 font-medium text-sm">
                        Tu ecosistema de finanzas personales.
                    </p>
                </div>

                <div className="space-y-5 relative z-10">
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-100 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group text-base"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        ) : (
                            <GoogleLogo />
                        )}

                        {loading ? 'Conectando...' : 'Continuar con Google'}

                        {!loading && (
                            <ArrowRight
                                size={18}
                                className="group-hover:translate-x-1 transition-transform opacity-50"
                            />
                        )}
                    </button>

                    {error && (
                        <div className="text-red-400 text-sm font-bold bg-red-400/10 p-3 rounded-lg border border-red-400/20 text-center">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center gap-2 justify-center pt-2">
                        <Shield size={12} className="text-white/20" />
                        <p className="text-[10px] text-white/20 font-medium">
                            Autenticación segura vía Google. No almacenamos contraseñas.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}