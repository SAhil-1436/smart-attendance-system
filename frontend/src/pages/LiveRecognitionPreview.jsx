import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import { 
  Camera, 
  CameraOff, 
  ScanFace, 
  ShieldCheck, 
  ShieldAlert, 
  AlertCircle, 
  Sliders, 
  RefreshCw, 
  Sparkles, 
  UserCheck, 
  CheckCircle2,
  GraduationCap,
  Activity,
  Maximize2
} from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';

export default function LiveRecognitionPreview() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [threshold, setThreshold] = useState(0.65);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [stats, setStats] = useState({ checks: 0, recognizedCount: 0 });

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
    setIsScanning(false);
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Frame capture and recognition loop
  useEffect(() => {
    scanningRef.current = isScanning;
    if (!isScanning || !cameraActive) return;

    let timeoutId;
    const processFrame = async () => {
      if (!scanningRef.current || !videoRef.current || videoRef.current.readyState !== 4) {
        timeoutId = setTimeout(processFrame, 500);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 270;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, 360, 270);
      const frameData = canvas.toDataURL('image/jpeg', 0.8);

      try {
        const res = await api.post('/attendance/recognize', {
          image_data: frameData,
          threshold: Number(threshold)
        });
        setRecognitionResult(res.data);
        setStats(prev => ({
          checks: prev.checks + 1,
          recognizedCount: prev.recognizedCount + (res.data.is_recognized ? 1 : 0)
        }));
      } catch (err) {
        console.error('Recognition error:', err);
      }

      if (scanningRef.current) {
        timeoutId = setTimeout(processFrame, 650);
      }
    };

    processFrame();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isScanning, cameraActive, threshold]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800/80 p-6 rounded-3xl backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/5 shrink-0">
            <ScanFace className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Live Face Recognition Engine
              </h2>
              <Badge variant="secondary" className="font-mono text-[10px]">
                YuNet + SFace (128-d)
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Real-time deep facial identification against registered student vector embeddings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsScanning(!isScanning)}
            disabled={!cameraActive}
            variant={isScanning ? 'destructive' : 'glow'}
            icon={isScanning ? CameraOff : Camera}
          >
            {isScanning ? 'Pause Recognition' : 'Start Live Recognition'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Viewport (2 Columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative aspect-video rounded-3xl overflow-hidden bg-slate-950 border border-slate-800/90 shadow-2xl flex items-center justify-center">
            {cameraError ? (
              <div className="p-8 text-center text-slate-400 max-w-sm">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
                  <CameraOff className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-red-300 mb-4 leading-relaxed">{cameraError}</p>
                <Button
                  onClick={startCamera}
                  variant="outline"
                  size="sm"
                  icon={RefreshCw}
                >
                  Retry Camera
                </Button>
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

                {/* Status Overlay Pill */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-xs pointer-events-none">
                  <div className={`px-3.5 py-1.5 rounded-full backdrop-blur-md border flex items-center gap-2.5 shadow-xl transition duration-200 ${
                    !isScanning
                      ? 'bg-slate-950/80 text-slate-400 border-slate-800'
                      : recognitionResult?.is_recognized
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-emerald-500/10'
                      : recognitionResult?.face_detected
                      ? 'bg-red-950/80 text-red-300 border-red-500/50'
                      : 'bg-slate-950/80 text-slate-300 border-slate-700'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      !isScanning
                        ? 'bg-slate-500'
                        : recognitionResult?.is_recognized
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-red-500'
                    }`} />
                    <span className="font-semibold text-[11px]">
                      {!isScanning 
                        ? 'Scanner Idle' 
                        : recognitionResult?.is_recognized
                        ? `Identified: ${recognitionResult.student?.name} (${(recognitionResult.similarity_score * 100).toFixed(1)}%)`
                        : recognitionResult?.face_detected
                        ? `Unknown Person (${(recognitionResult.similarity_score * 100).toFixed(1)}% < ${(threshold * 100).toFixed(0)}%)`
                        : 'No Face in View'}
                    </span>
                  </div>

                  <div className="bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full text-slate-300 border border-slate-800 font-mono text-[11px]">
                    Threshold: <span className="text-indigo-400 font-bold">{threshold}</span>
                  </div>
                </div>

                {/* Target Box Guide */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className={`w-64 h-72 rounded-[48px] border-2 border-dashed transition-all duration-300 ${
                    !isScanning
                      ? 'border-slate-700/60'
                      : recognitionResult?.is_recognized
                      ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_50px_rgba(52,211,153,0.3)]'
                      : recognitionResult?.face_detected
                      ? 'border-red-400/80 bg-red-500/5 shadow-[0_0_35px_rgba(248,113,113,0.2)]'
                      : 'border-slate-600/70'
                  }`} />
                </div>
              </>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-center">
              <div className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">Scanner Status</div>
              <div className="text-sm font-bold text-white mt-1 flex items-center justify-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                {isScanning ? 'Scanning' : 'Paused'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-center">
              <div className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">Total Scans</div>
              <div className="text-base font-bold text-indigo-400 font-mono mt-0.5">
                {stats.checks}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-center">
              <div className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">Recognitions</div>
              <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                {stats.recognizedCount}
              </div>
            </div>
          </div>
        </div>

        {/* Identity HUD & Config (1 Column) */}
        <div className="space-y-4">
          {/* Active Recognized Student Card */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                Live Identity Result
              </h3>
              {recognitionResult?.is_recognized && (
                <Badge variant="success" dot>
                  {recognitionResult.confidence_level} MATCH
                </Badge>
              )}
            </div>

            {recognitionResult?.is_recognized && recognitionResult.student ? (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3.5">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-emerald-600/25 shrink-0">
                    {recognitionResult.student.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white leading-tight">
                      {recognitionResult.student.name}
                    </h4>
                    <span className="text-xs font-mono text-indigo-400 font-semibold">
                      {recognitionResult.student.student_id}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Course & Dept</span>
                    <span className="font-semibold text-slate-200">{recognitionResult.student.course_name || 'BTECH_CSE'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Batch</span>
                    <span className="font-semibold text-slate-200 font-mono">Sem {recognitionResult.student.semester} &bull; Sec {recognitionResult.student.section}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                    <span className="text-slate-400">Similarity Score</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {(recognitionResult.similarity_score * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Verified Against 128-d Biometric Embeddings</span>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-slate-500">
                <ScanFace className="w-12 h-12 mx-auto mb-3 text-slate-700" />
                <p className="text-xs font-medium text-slate-400 max-w-[220px] mx-auto">
                  {isScanning 
                    ? (recognitionResult?.message || 'Scanning for registered student vectors...') 
                    : 'Click "Start Live Recognition" to begin matching faces.'}
                </p>
              </div>
            )}
          </div>

          {/* Configurable Recognition Threshold Slider */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                Matching Threshold
              </h3>
              <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-lg border border-indigo-500/20">
                {threshold}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Cosine similarity cutoff. Lower threshold increases tolerance for lighting and angles; higher threshold reduces false accepts.
            </p>

            <input
              type="range"
              min="0.40"
              max="0.85"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer mb-2 h-1.5 bg-slate-800 rounded-lg"
            />

            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>0.40 (Tolerant)</span>
              <span>0.65 (Recommended)</span>
              <span>0.85 (Strict)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

