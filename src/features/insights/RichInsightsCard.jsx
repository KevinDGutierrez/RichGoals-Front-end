import React from 'react';
import { Sparkles, AlertTriangle, TrendingUp, CheckCircle, Info, ShieldAlert } from 'lucide-react';
import { getRichInsights } from './RichInsightsEngine';

const RichInsightsCard = ({ userData, section, limit = 3 }) => {
    const allInsights = getRichInsights(userData, section);

    if (!allInsights || allInsights.length === 0) return null;
    
    // Limit insights
    const insights = allInsights.slice(0, limit);

    const getIcon = (type) => {
        switch (type) {
            case 'danger': return <ShieldAlert size={18} className="text-red-400 shrink-0" />;
            case 'warning': return <AlertTriangle size={18} className="text-amber-400 shrink-0" />;
            case 'success': return <CheckCircle size={18} className="text-emerald-400 shrink-0" />;
            case 'info': return <Info size={18} className="text-blue-300 shrink-0" />;
            default: return <TrendingUp size={18} className="text-white shrink-0" />;
        }
    };

    const getBorderColor = (type) => {
        switch (type) {
            case 'danger': return 'border-red-500/30';
            case 'warning': return 'border-amber-500/30';
            case 'success': return 'border-emerald-500/30';
            case 'info': return 'border-blue-400/30';
            default: return 'border-white/10';
        }
    };

    return (
        <div className="w-full h-full flex flex-col">
            {/* Minimal Header */}
            <div className="flex items-center gap-2 mb-3 px-1">
                <Sparkles size={12} className="text-aura-primary animate-pulse" />
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] italic">Rich Insights</span>
            </div>

            {/* Single Cohesive Card */}
            <div className="flex-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-center group shadow-2xl">
                {/* Decorative background glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-aura-primary/5 rounded-full blur-[40px] -mr-10 -mt-10 opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />
                
                <div className="space-y-4 relative z-10 font-sans">
                    {insights.map((insight, idx) => (
                        <div key={idx} className="flex gap-4 items-start animate-in fade-in slide-in-from-right-3 duration-500 delay-150">
                            <div className="mt-1">
                                {getIcon(insight.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] md:text-sm text-white/90 leading-snug font-medium tracking-tight">
                                    {/* Use dangerouslySetInnerHTML if we want to support markdown bolding, or just replace ** with strong */}
                                    {insight.message.split('**').map((part, i) => (
                                        i % 2 === 1 ? <strong key={i} className="text-white font-black">{part}</strong> : part
                                    ))}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Subtle progress bar at bottom for looks */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 overflow-hidden">
                    <div className="h-full bg-aura-primary/20 w-1/3 animate-[progress_3s_infinite_linear]" />
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes progress {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(300%); }
                }
            `}} />
        </div>
    );
};

export default RichInsightsCard;
