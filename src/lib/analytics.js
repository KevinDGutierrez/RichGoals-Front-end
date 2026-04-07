/**
 * RichGoals Analytics – lightweight user behavior tracking
 * Events are buffered in memory and flushed to Firestore periodically.
 */
import { db } from '../firebase';
import { doc, setDoc, arrayUnion, getDoc } from '../services/backendFirestore.js';

// ── Config
const FLUSH_INTERVAL = 30_000; // 30 seconds
const SESSION_COLLECTION = 'analytics';

let _uid = null;
let _sessionId = null;
let _sessionStart = null;
let _buffer = [];
let _flushTimer = null;
let _tabCounts = {};
let _isFlushing = false;
let _beforeUnloadBound = false;

// ── Helpers
const ts = () => new Date().toISOString();
const monthKey = () => new Date().toISOString().substring(0, 7);

const deviceType = () => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod|Android/i.test(ua)) return 'mobile';
    if (/Macintosh/i.test(ua)) return 'mac';
    return 'pc';
};

function resetAnalyticsState() {
    _uid = null;
    _sessionId = null;
    _sessionStart = null;
    _buffer = [];
    _tabCounts = {};
    _isFlushing = false;

    if (_flushTimer) {
        clearInterval(_flushTimer);
        _flushTimer = null;
    }

    if (_beforeUnloadBound) {
        window.removeEventListener('beforeunload', handleUnload);
        _beforeUnloadBound = false;
    }
}

// ── Public API

/**
 * Start a new analytics session when user logs in.
 */
export function startSession(userId) {
    if (!userId) return;

    // Si había una sesión anterior viva, limpiarla primero
    if (_flushTimer) {
        clearInterval(_flushTimer);
        _flushTimer = null;
    }

    if (_beforeUnloadBound) {
        window.removeEventListener('beforeunload', handleUnload);
        _beforeUnloadBound = false;
    }

    _uid = userId;
    _sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    _sessionStart = Date.now();
    _buffer = [];
    _tabCounts = {};
    _isFlushing = false;

    trackEvent('session_start', { device: deviceType() });

    _flushTimer = setInterval(() => {
        flush();
    }, FLUSH_INTERVAL);

    window.addEventListener('beforeunload', handleUnload);
    _beforeUnloadBound = true;
}

/**
 * End the current session (on logout or page close).
 */
export async function endSession() {
    if (!_uid) return;

    const duration = Math.round((Date.now() - (_sessionStart || Date.now())) / 1000);
    trackEvent('session_end', { durationSeconds: duration });

    try {
        await flush({ finalFlush: true });
    } catch (err) {
        console.warn('[Analytics] endSession flush warning:', err?.message || err);
    } finally {
        resetAnalyticsState();
    }
}

/**
 * Track a named event with optional metadata.
 */
export function trackEvent(name, data = {}) {
    if (!_uid) return;

    _buffer.push({
        event: name,
        data,
        timestamp: ts(),
    });

    if (name === 'tab_view' && data.tab) {
        _tabCounts[data.tab] = (_tabCounts[data.tab] || 0) + 1;
    }
}

/**
 * Track errors caught by ErrorBoundary or try/catch.
 */
export function trackError(component, message, stack) {
    trackEvent('app_error', {
        component,
        message: (message || '').substring(0, 200),
        stack: (stack || '').substring(0, 300),
    });

    flush().catch((err) => {
        console.warn('[Analytics] immediate error flush warning:', err?.message || err);
    });
}

// ── Internal

function handleUnload() {
    // En beforeunload no bloqueamos el cierre; solo intentamos cerrar limpio.
    endSession().catch(() => { });
}

async function flush({ finalFlush = false } = {}) {
    if (!_uid || _buffer.length === 0 || _isFlushing) return;

    _isFlushing = true;

    const currentUid = _uid;
    const currentSessionId = _sessionId;
    const currentSessionStart = _sessionStart;
    const events = [..._buffer];
    const tabCountsSnapshot = { ..._tabCounts };

    // Vaciamos temporalmente buffer; si falla, lo restauramos
    _buffer = [];
    _tabCounts = {};

    try {
        const month = monthKey();
        const sessionDoc = doc(db, SESSION_COLLECTION, currentUid, 'sessions', currentSessionId);

        await setDoc(
            sessionDoc,
            {
                sessionId: currentSessionId,
                startedAt: new Date(currentSessionStart).toISOString(),
                device: deviceType(),
                lastFlush: ts(),
                endedAt: finalFlush ? ts() : undefined,
                events: arrayUnion(...events),
            },
            { merge: true }
        );

        const summaryRef = doc(db, SESSION_COLLECTION, currentUid, 'monthly', month);
        const summarySnap = await getDoc(summaryRef);
        const existing = summarySnap.exists() ? summarySnap.data() : {};

        const sessionsCount =
            (existing.sessionsCount || 0) +
            (events.some((e) => e.event === 'session_start') ? 1 : 0);

        const featureUsage = { ...(existing.featureUsage || {}) };

        Object.keys(tabCountsSnapshot).forEach((tab) => {
            featureUsage[tab] = (existing.featureUsage?.[tab] || 0) + tabCountsSnapshot[tab];
        });

        const actionCounts = { ...(existing.actionCounts || {}) };

        events.forEach((e) => {
            if (
                [
                    'expense_added',
                    'expense_deleted',
                    'payment_made',
                    'debt_added',
                    'funds_added',
                    'funds_withdrawn',
                    'transfer_to_income',
                    'budget_category_added',
                    'budget_updated',
                    'fixed_expense_paid',
                ].includes(e.event)
            ) {
                actionCounts[e.event] = (actionCounts[e.event] || 0) + 1;
            }
        });

        const errorCount =
            (existing.errorCount || 0) +
            events.filter((e) => e.event === 'app_error').length;

        await setDoc(
            summaryRef,
            {
                month,
                sessionsCount,
                featureUsage,
                actionCounts,
                errorCount,
                lastDevice: deviceType(),
                updatedAt: ts(),
            },
            { merge: true }
        );
    } catch (err) {
        const status = err?.response?.status;

        // Si ya no hay auth válida, no volvemos a meter el buffer para evitar loops de 401
        if (status !== 401) {
            _buffer = [...events, ..._buffer];

            Object.keys(tabCountsSnapshot).forEach((tab) => {
                _tabCounts[tab] = (_tabCounts[tab] || 0) + tabCountsSnapshot[tab];
            });
        }

        console.warn('[Analytics] flush error:', err?.message || err);
    } finally {
        _isFlushing = false;
    }
}