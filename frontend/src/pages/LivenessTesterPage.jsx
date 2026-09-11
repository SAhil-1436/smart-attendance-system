import React, { useState } from 'react';
import LivenessChallengeWidget from '../components/LivenessChallengeWidget';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  ArrowLeftRight, 
  Smartphone, 
  Image as ImageIcon,
  Sparkles,
  Info,
  Key
} from 'lucide-react';
import Badge from '../components/ui/Badge';

export default function LivenessTesterPage() {
  const [lastVerifiedReceipt, setLastVerifiedReceipt] = useState(null);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800/80 p-6 rounded-3xl backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/5 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Liveness & Anti-Spoofing Verification
              </h2>
              <Badge variant="success" dot>
                Active Challenge-Response
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Validates human presence using randomized action sequences, blink detection, and head pose estimation
            </p>
          </div>
        </div>

        {lastVerifiedReceipt && (
          <div className="px-3.5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2.5 shadow-lg shadow-emerald-500/5 animate-in fade-in">
            <Key className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Receipt: <strong className="text-white">{lastVerifiedReceipt.slice(0, 16)}...</strong></span>
          </div>
        )}
      </div>

      {/* Main Interactive Widget */}
      <LivenessChallengeWidget onVerified={(receipt) => setLastVerifiedReceipt(receipt)} />

      {/* Anti-Spoofing Verification Test Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md hover:border-emerald-500/30 transition duration-200">
          <div className="flex items-center gap-3.5 mb-3.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Live Human Face</h4>
              <p className="text-[11px] text-emerald-400 font-semibold mt-0.5">Expected: Pass</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Responsive user complies with randomized challenge steps (head turn left/right, eye blink). Continuous micro-motion passes temporal variance analysis.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md hover:border-red-500/30 transition duration-200">
          <div className="flex items-center gap-3.5 mb-3.5">
            <div className="p-2.5 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Printed Photograph</h4>
              <p className="text-[11px] text-red-400 font-semibold mt-0.5">Expected: Fail / Rejected</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Static paper printouts fail dynamic challenge prompts (cannot perform head turns or blinks) and exhibit near-zero temporal landmark micro-motion.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md hover:border-amber-500/30 transition duration-200">
          <div className="flex items-center gap-3.5 mb-3.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Phone Screen Replay</h4>
              <p className="text-[11px] text-amber-400 font-semibold mt-0.5">Expected: Fail / Rejected</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Pre-recorded video replays cannot dynamically synchronize with randomized 25-second server challenge sequences issued on demand.
          </p>
        </div>
      </div>
    </div>
  );
}

