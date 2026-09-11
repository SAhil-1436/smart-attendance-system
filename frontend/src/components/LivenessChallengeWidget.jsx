import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Eye, 
  Smile, 
  ArrowLeft, 
  ArrowRight, 
  Clock, 
  Sparkles, 
  Info,
  Loader2,
  CameraOff
} from 'lucide-react';

export default function LivenessChallengeWidget({ onVerified, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const processingRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [verifiedReceipt, setVerifiedReceipt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(25);
  const [isExpired, setIsExpired] = useState(false);
  const [loading, setLoading] = useState(false);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Camera access denied or unavailable. Please grant webcam permissions.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const fetchNewChallenge = async () => {
    setLoading(true);
    setActionFeedback(null);
    setVerifiedReceipt(null);
    setIsExpired(false);
    setTimeLeft(25);
    setCurrentStep(1);

    try {
      const res = await api.post('/attendance/liveness/challenge');
      setChallenge(res.data);
    } catch (err) {
      console.error('Failed to get liveness challenge', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startCamera();
    fetchNewChallenge();
    return () => {
      stopCamera();
    };
  }, []);

  // 25s Countdown timer
  useEffect(() => {
    if (!challenge || verifiedReceipt || isExpired) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [challenge, verifiedReceipt, isExpired]);

  // Frame processing loop
  useEffect(() => {
    if (!challenge || !cameraActive || verifiedReceipt || isExpired) return;

    let timeoutId;
    const checkFrame = async () => {
      if (processingRef.current || !videoRef.current || videoRef.current.readyState !== 4) {
        timeoutId = setTimeout(checkFrame, 400);
        return;
      }

      processingRef.current = true;
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      const frameData = canvas.toDataURL('image/jpeg', 0.8);

      try {
        const res = await api.post('/attendance/liveness/verify-step', {
          challenge_id: challenge.challenge_id,
          image_data: frameData
        });
        const data = res.data;
        setActionFeedback(data);

        if (data.step_passed) {
          if (data.completed) {
            setVerifiedReceipt(data.receipt_token);
            if (onVerified) onVerified(data.receipt_token);
          } else {
            setCurrentStep(data.step);
            setChallenge(prev => ({
              ...prev,
              current_action: data.next_action,
              step: data.step,
              instructions: data.instructions
            }));
          }
        }
      } catch (err) {
        console.error('Step verification error:', err);
      } finally {
        processingRef.current = false;
      }

      if (!verifiedReceipt && !isExpired) {
        timeoutId = setTimeout(checkFrame, 450);
      }
    };

    checkFrame();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [challenge, cameraActive, verifiedReceipt, isExpired]);

  const getActionIcon = (action) => {
    switch (action) {
      case 'TURN_LEFT': return ArrowLeft;
      case 'TURN_RIGHT': return ArrowRight;
      case 'BLINK': return Eye;
      case 'SMILE': return Smile;
      default: return Sparkles;
    }
  };

  const CurrentIcon = challenge ? getActionIcon(challenge.current_action) : Sparkles;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-2xl mx-auto text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-2xl border border-purple-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Liveness Verification & Anti-Spoofing
            </h3>
            <p className="text-xs text-slate-400">
              Interactive challenge-response to prevent photo & video proxies
            </p>
          </div>
        </div>

        {/* Countdown Pill */}
        <div className="flex items-center gap-2">
          {!verifiedReceipt && (
            <div className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 border ${
              timeLeft > 10 
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' 
                : 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              {timeLeft}s
            </div>
          )}
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Video Viewport */}
      <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800 mb-5 shadow-inner flex items-center justify-center">
        {cameraError ? (
          <div className="p-6 text-center text-slate-400">
            <CameraOff className="w-10 h-10 mx-auto mb-2 text-red-400" />
            <p className="text-xs font-medium text-red-300 mb-3">{cameraError}</p>
            <button
              onClick={startCamera}
              className="px-4 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-white font-medium inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Camera
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Target Oval Guide */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className={`w-56 h-64 rounded-[48px] border-2 border-dashed transition-all duration-300 ${
                verifiedReceipt 
                  ? 'border-emerald-400 bg-emerald-500/15 shadow-[0_0_50px_rgba(52,211,153,0.3)]' 
                  : isExpired 
                  ? 'border-red-400 bg-red-500/10'
                  : 'border-indigo-400/80 bg-indigo-500/5'
              }`} />
            </div>

            {/* In-Frame Live Instruction Badge */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-xs pointer-events-none">
              <div className="bg-black/75 backdrop-blur px-3 py-1.5 rounded-full border border-slate-700 text-slate-200 flex items-center gap-2">
                <CurrentIcon className="w-4 h-4 text-indigo-400 animate-bounce" />
                <span className="font-semibold text-[11px]">
                  {verifiedReceipt 
                    ? 'Liveness Confirmed' 
                    : isExpired 
                    ? 'Session Expired' 
                    : challenge?.instructions || 'Analyzing...'}
                </span>
              </div>

              {actionFeedback?.details?.detected_pose && (
                <div className="bg-black/75 backdrop-blur px-2.5 py-1 rounded-full border border-slate-700 text-slate-400 font-mono text-[10px]">
                  Pose: <span className="text-white font-bold">{actionFeedback.details.detected_pose}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Challenge Action Indicator Bar */}
      {!verifiedReceipt && !isExpired && challenge && (
        <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/40">
              <CurrentIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
                Step {currentStep} of {challenge.total_steps} Challenge
              </div>
              <div className="text-sm font-bold text-white mt-0.5">
                {challenge.instructions}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Verifying
            </span>
          </div>
        </div>
      )}

      {/* Verification Success State */}
      {verifiedReceipt && (
        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 mb-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-white">Genuine Human Liveness Confirmed</h4>
              <p className="text-xs text-emerald-400/90">All challenge actions verified successfully.</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-[11px]">
            <span className="font-mono text-emerald-400">Token: {verifiedReceipt.slice(0, 18)}...</span>
            <span className="text-emerald-400/80">Valid for 60 seconds</span>
          </div>
        </div>
      )}

      {/* Expired State */}
      {isExpired && !verifiedReceipt && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 mb-5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>Challenge expired. Please click restart to generate a fresh action sequence.</span>
          </div>
          <button
            onClick={fetchNewChallenge}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Restart
          </button>
        </div>
      )}

      {/* Honest Limitations Notice */}
      <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 text-[11px] text-slate-400 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-300">Engineering Transparency:</strong> Active challenge-response effectively defeats static printouts, motionless screen photos, and uncoordinated attempts. Advanced deepfake models or multi-spectral attacks require specialized hardware infrared/depth sensors.
        </p>
      </div>
    </div>
  );
}
