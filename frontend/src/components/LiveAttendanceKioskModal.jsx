import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Camera, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  UserCheck, 
  Clock, 
  Volume2, 
  VolumeX, 
  Flame, 
  Sparkles,
  ArrowRight,
  Smile,
  Eye,
  RotateCcw
} from 'lucide-react';
import api from '../services/api';

export default function LiveAttendanceKioskModal({ session, isOpen, onClose, onRecordMarked }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Kiosk Modes: 'IDLE' | 'LIVENESS_CHALLENGE' | 'VERIFYING_ATTENDANCE' | 'SUCCESS_MARKED' | 'ERROR'
  const [kioskState, setKioskState] = useState('IDLE');
  const [challengeData, setChallengeData] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [instructions, setInstructions] = useState('');
  const [stepFeedback, setStepFeedback] = useState('');
  const [receiptToken, setReceiptToken] = useState(null);

  const [lastMarkedStudent, setLastMarkedStudent] = useState(null);
  const [recentAttendees, setRecentAttendees] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const isProcessingRef = useRef(false);

  // Audio tone synthesizer using Web Audio API
  const playChime = useCallback((type = 'success') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } else if (type === 'duplicate') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(329.63, audioCtx.currentTime); // E4
        osc.frequency.setValueAtTime(261.63, audioCtx.currentTime + 0.15); // C4
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn("Audio chime failed:", e);
    }
  }, [soundEnabled]);

  // Load existing records for session ticker
  const fetchSessionRecords = useCallback(async () => {
    if (!session) return;
    try {
      const res = await api.get(`/sessions/${session.id}/records`);
      setRecentAttendees(res.data.slice(0, 10));
    } catch (err) {
      console.error("Failed to fetch session records:", err);
    }
  }, [session]);

  // Start webcam
  const startCamera = async () => {
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
    } catch (err) {
      console.error("Camera access error:", err);
      setErrorMessage("Unable to access camera. Please allow webcam permissions.");
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Capture frame as base64
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  // 1. Begin Challenge-Response Liveness
  const startLivenessChallenge = async () => {
    setErrorMessage(null);
    setLastMarkedStudent(null);
    setKioskState('LIVENESS_CHALLENGE');
    try {
      const res = await api.post('/attendance/liveness/challenge');
      setChallengeData(res.data);
      setCurrentStepIndex(1);
      setInstructions(res.data.instructions);
      setStepFeedback('Please follow the prompt on screen...');
    } catch (err) {
      setErrorMessage(err.response?.data?.detail || "Failed to start anti-spoofing challenge.");
      setKioskState('IDLE');
    }
  };

  // 2. Continuous Step Verification Loop
  useEffect(() => {
    let intervalId = null;
    if (kioskState === 'LIVENESS_CHALLENGE' && challengeData) {
      intervalId = setInterval(async () => {
        if (isProcessingRef.current) return;
        const frame = captureFrame();
        if (!frame) return;

        try {
          isProcessingRef.current = true;
          const res = await api.post('/attendance/liveness/verify-step', {
            challenge_id: challengeData.challenge_id,
            image_data: frame
          });

          const data = res.data;
          setStepFeedback(data.message);

          if (data.completed || data.status === 'CHALLENGE_COMPLETED') {
            setReceiptToken(data.receipt_token);
            setKioskState('VERIFYING_ATTENDANCE');
            // Auto mark attendance with this frame and the receipt token!
            markAttendance(frame, data.receipt_token);
          } else if (data.step_passed || data.status === 'STEP_PASSED') {
            if (data.step) setCurrentStepIndex(data.step);
            if (data.instructions) setInstructions(data.instructions);
          }
        } catch (err) {
          const detail = err.response?.data?.detail || "Verification failed";
          setErrorMessage(detail);
          setKioskState('IDLE');
        } finally {
          isProcessingRef.current = false;
        }
      }, 300);
    }
    return () => clearInterval(intervalId);
  }, [kioskState, challengeData]);

  // 3. Mark Attendance with Face + Token
  const markAttendance = async (frame, token) => {
    try {
      const res = await api.post('/attendance/mark', {
        session_id: session.id,
        image_data: frame,
        liveness_receipt_token: token
      });

      const markData = res.data;
      setLastMarkedStudent(markData);
      setKioskState('SUCCESS_MARKED');
      playChime('success');
      fetchSessionRecords();
      if (onRecordMarked) onRecordMarked();

      // Reset back to ready after 4 seconds
      setTimeout(() => {
        setKioskState('IDLE');
        setLastMarkedStudent(null);
      }, 4500);

    } catch (err) {
      if (err.response?.status === 409) {
        // Duplicate attendance
        playChime('duplicate');
        setErrorMessage(err.response?.data?.detail || "Duplicate attendance detected!");
        setKioskState('DUPLICATE');
        setTimeout(() => {
          setKioskState('IDLE');
          setErrorMessage(null);
        }, 4000);
      } else {
        setErrorMessage(err.response?.data?.detail || "Could not verify identity for attendance.");
        setKioskState('ERROR');
        setTimeout(() => {
          setKioskState('IDLE');
          setErrorMessage(null);
        }, 4000);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
      fetchSessionRecords();
      setKioskState('IDLE');
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Kiosk Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Live Attendance Kiosk
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                  ACTIVE SESSION
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {session.subject_name} ({session.subject_code}) • Sem {session.semester}-{session.section} • {session.course_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute audio" : "Enable chime"}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Kiosk Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 flex-1 overflow-y-auto">
          
          {/* Left / Center 2 Cols: Live Camera Stream & Interactive HUD */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center">
            <div className="relative w-full aspect-[4/3] max-w-lg bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Dynamic Target Oval Guide & Corner Brackets */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                {/* HUD Corner Brackets */}
                <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-indigo-400/60" />
                <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-indigo-400/60" />
                <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-indigo-400/60" />
                <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-indigo-400/60" />

                <div className={`w-52 h-64 rounded-full border-2 transition-all duration-300 relative flex items-center justify-center ${
                  kioskState === 'SUCCESS_MARKED'
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_35px_rgba(16,185,129,0.4)] scale-105'
                    : kioskState === 'DUPLICATE'
                    ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_35px_rgba(245,158,11,0.4)]'
                    : kioskState === 'LIVENESS_CHALLENGE'
                    ? 'border-indigo-500 border-dashed animate-pulse bg-indigo-500/5'
                    : 'border-slate-400/40'
                }`}>
                  {/* Subtle target crosshairs */}
                  <div className="absolute w-4 h-0.5 bg-slate-400/30" />
                  <div className="absolute h-4 w-0.5 bg-slate-400/30" />
                </div>

                {/* Alignment status cue badge */}
                <div className="mt-3 px-3 py-1 rounded-full bg-slate-950/70 border border-slate-700/80 backdrop-blur text-[10px] font-medium text-slate-300">
                  {kioskState === 'IDLE' && 'Center face within the oval guide'}
                  {kioskState === 'LIVENESS_CHALLENGE' && 'Keep face inside guide & follow instructions'}
                  {kioskState === 'VERIFYING_ATTENDANCE' && 'Hold still — matching biometric signature...'}
                  {kioskState === 'SUCCESS_MARKED' && '✓ Biometric Match Confirmed'}
                  {kioskState === 'DUPLICATE' && '⚠ Duplicate Entry Blocked'}
                  {kioskState === 'ERROR' && '✕ Retrying Recognition...'}
                </div>
              </div>

              {/* Challenge Instruction Overlay */}
              {kioskState === 'LIVENESS_CHALLENGE' && (
                <div className="absolute top-4 inset-x-4 bg-slate-900/90 backdrop-blur-md border border-indigo-500/40 rounded-xl p-3 shadow-lg flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-600/30 text-indigo-400 animate-bounce">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-300">
                        Liveness Step {currentStepIndex} of {challengeData?.total_steps || 2}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Anti-Spoofing</span>
                    </div>
                    <p className="text-sm font-bold text-white mt-0.5">{instructions}</p>
                    <p className="text-[11px] text-indigo-200/80 italic">{stepFeedback}</p>
                  </div>
                </div>
              )}

              {/* Success Badge Banner Overlay */}
              {kioskState === 'SUCCESS_MARKED' && lastMarkedStudent && (
                <div className="absolute inset-x-6 bottom-6 bg-emerald-950/95 border border-emerald-500/60 backdrop-blur-md rounded-2xl p-4 shadow-2xl flex items-center gap-4 animate-in fade-in zoom-in duration-200">
                  <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-lg">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {lastMarkedStudent.status}
                      </span>
                      <span className="text-xs text-emerald-400 font-mono">
                        {(lastMarkedStudent.confidence_score * 100).toFixed(1)}% Match
                      </span>
                    </div>
                    <h3 className="text-lg font-extrabold text-white mt-0.5">
                      {lastMarkedStudent.student_name}
                    </h3>
                    <p className="text-xs text-emerald-200/80 font-mono">
                      Roll No: {lastMarkedStudent.roll_number}
                    </p>
                  </div>
                </div>
              )}

              {/* Duplicate Badge Banner Overlay */}
              {kioskState === 'DUPLICATE' && (
                <div className="absolute inset-x-6 bottom-6 bg-amber-950/95 border border-amber-500/60 backdrop-blur-md rounded-2xl p-4 shadow-2xl flex items-center gap-4 animate-in fade-in zoom-in duration-200">
                  <div className="p-3 bg-amber-600 text-white rounded-xl shadow-lg">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Duplicate Attempt
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1">
                      {errorMessage || "Already Marked for this Session"}
                    </h3>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {kioskState === 'ERROR' && (
                <div className="absolute inset-x-6 bottom-6 bg-red-950/95 border border-red-500/60 backdrop-blur-md rounded-2xl p-4 shadow-2xl flex items-center gap-4">
                  <div className="p-3 bg-red-600 text-white rounded-xl shadow-lg">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs uppercase font-bold tracking-wider text-red-300">
                      Identification Error
                    </span>
                    <h3 className="text-sm font-semibold text-white mt-0.5">
                      {errorMessage || "Face not recognized. Please retry."}
                    </h3>
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar Below Camera */}
            <div className="mt-4 flex items-center gap-3 w-full max-w-lg">
              {kioskState === 'IDLE' ? (
                <button
                  onClick={startLivenessChallenge}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition active:scale-[0.99]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Verify Face & Mark Attendance
                </button>
              ) : (
                <button
                  onClick={() => {
                    setKioskState('IDLE');
                    setErrorMessage(null);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center gap-2 transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  Cancel / Reset Scanner
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Live Session Ticker & Quick Stats */}
          <div className="flex flex-col bg-slate-950/60 border border-slate-800 rounded-2xl p-4 h-full">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Live Attendance Roll</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {recentAttendees.length} Marked
              </span>
            </div>

            {/* Session Stats Banner */}
            <div className="grid grid-cols-2 gap-2 my-3">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Present</span>
                <p className="text-lg font-extrabold text-emerald-400 mt-0.5">
                  {recentAttendees.filter(r => r.status === 'PRESENT').length}
                </p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Late</span>
                <p className="text-lg font-extrabold text-amber-400 mt-0.5">
                  {recentAttendees.filter(r => r.status === 'LATE').length}
                </p>
              </div>
            </div>

            {/* Attendees Stream */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {recentAttendees.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-slate-500">
                  <Clock className="w-8 h-8 mb-2 opacity-50 stroke-1" />
                  <p className="text-xs font-medium">No attendees recorded yet.</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Click "Verify Face" to scan the first student.
                  </p>
                </div>
              ) : (
                recentAttendees.map((att, idx) => {
                  const isLatest = lastMarkedStudent && (att.student_name === lastMarkedStudent.student_name || idx === 0);
                  return (
                    <div
                      key={att.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all duration-300 ${
                        isLatest
                          ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md shadow-emerald-500/10 scale-[1.01]'
                          : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-white leading-snug">
                            {att.student_name}
                          </h4>
                          {isLatest && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                              NEW
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {att.roll_number}
                        </p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          att.status === 'PRESENT'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : att.status === 'LATE'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        }`}>
                          {att.status}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {new Date(att.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Anti-spoofing security indicator */}
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Anti-Spoofing Active
              </span>
              <span className="text-slate-500 font-mono">YuNet + SFace</span>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
