import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import { 
  Camera, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  Trash2, 
  Loader2, 
  Sparkles, 
  CameraOff, 
  Smile, 
  Eye, 
  UserCheck,
  Fingerprint
} from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';

export default function FaceRegistrationModal({ isOpen = true, onClose, student, onEnrolled }) {
  if (!isOpen || !student) return null;

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [validating, setValidating] = useState(false);
  const [frameFeedback, setFrameFeedback] = useState(null);
  const [samples, setSamples] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { title: 'Sample 1: Neutral Expression', desc: 'Look directly at the camera with a neutral face.', icon: Eye },
    { title: 'Sample 2: Gentle Smile', desc: 'Smile slightly while keeping full eye contact.', icon: Smile },
    { title: 'Sample 3: Subtle Head Tilt', desc: 'Turn head slightly (5-10 degrees) for multi-angle vectors.', icon: UserCheck }
  ];

  // Start webcam
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
      setCameraError('Camera access denied or unavailable. Please grant webcam permissions in browser.');
      setCameraActive(false);
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (isOpen) {
      setSamples([]);
      setError(null);
      setSuccessMessage(null);
      setCurrentStep(0);
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Periodic quality check of current webcam view
  useEffect(() => {
    if (!cameraActive || submitting || samples.length >= 3) return;

    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState !== 4) return;
      
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = 320;
      offscreenCanvas.height = 240;
      const ctx = offscreenCanvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      const frameData = offscreenCanvas.toDataURL('image/jpeg', 0.7);

      try {
        const res = await api.post('/face/validate-frame', { image_data: frameData });
        setFrameFeedback(res.data);
      } catch (err) {
        // Silently skip live probing errors
      }
    }, 800);

    return () => clearInterval(interval);
  }, [cameraActive, submitting, samples.length]);

  // Capture current frame as sample
  const handleCaptureSample = () => {
    if (!videoRef.current || !cameraActive) return;
    setError(null);

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    const b64 = canvas.toDataURL('image/jpeg', 0.9);

    const newSamples = [...samples, b64];
    setSamples(newSamples);
    if (newSamples.length < 3) {
      setCurrentStep(newSamples.length);
    }
  };

  const handleRetakeSample = (index) => {
    const updated = samples.filter((_, i) => i !== index);
    setSamples(updated);
    setCurrentStep(updated.length);
    setError(null);
    setSuccessMessage(null);
  };

  // Submit enrollment with 3 samples
  const handleEnrollSubmit = async () => {
    if (samples.length < 3) {
      setError('Please capture all 3 diverse face samples before enrolling.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post(`/students/${student.id}/face-enroll`, {
        images: samples
      });
      setSuccessMessage(res.data.message);
      stopCamera();
      if (onEnrolled) onEnrolled();
    } catch (err) {
      setError(err.response?.data?.detail || 'Face enrollment failed. Please recapture.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset face data
  const handleResetFaceData = async () => {
    if (!window.confirm(`Reset biometric data for ${student.name}? Student will need to be re-enrolled.`)) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.delete(`/students/${student.id}/face-embeddings`);
      setSamples([]);
      setCurrentStep(0);
      setSuccessMessage('Biometric data successfully reset. You can now enroll new samples.');
      if (onEnrolled) onEnrolled();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset biometric data.');
    } finally {
      setSubmitting(false);
    }
  };

  const StepIcon = steps[currentStep]?.icon || Eye;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900/95 border border-slate-800/90 rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl relative text-slate-100 max-h-[95vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 flex items-center justify-center shadow-lg shadow-indigo-500/5 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Biometric Face Enrollment
                </h2>
                <Badge variant="glow" className="font-mono text-[10px]">
                  {student.student_id}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {student.name} &bull; Sem {student.semester}-{student.section}
              </p>
            </div>
          </div>

          {student.face_registered && (
            <Button
              onClick={handleResetFaceData}
              disabled={submitting}
              variant="destructive"
              size="sm"
              icon={Trash2}
              className="text-[11px] h-8"
            >
              Reset Face Data
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center gap-3 text-xs text-red-400 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs text-emerald-300 animate-in fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <Button
              onClick={onClose}
              variant="success"
              size="sm"
            >
              Done
            </Button>
          </div>
        )}

        {/* Camera Viewfinder & Guide */}
        {!successMessage && (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video border border-slate-800/90 flex items-center justify-center shadow-inner">
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

                  {/* Face Guide Target Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className={`w-56 h-64 rounded-[40px] border-2 border-dashed transition-all duration-300 flex items-center justify-center ${
                      frameFeedback?.valid 
                        ? 'border-emerald-400 bg-emerald-500/5 shadow-[0_0_35px_rgba(52,211,153,0.25)]' 
                        : frameFeedback?.face_detected 
                        ? 'border-amber-400 bg-amber-500/5' 
                        : 'border-slate-500/60'
                    }`}>
                      <div className="text-center p-3">
                        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border backdrop-blur-md shadow-lg ${
                          frameFeedback?.valid 
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' 
                            : 'bg-slate-950/80 text-slate-300 border-slate-700'
                        }`}>
                          {frameFeedback?.message || 'Position face within frame'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Top Status Pill */}
                  <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between text-[11px] pointer-events-none">
                    <div className="bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full text-slate-300 border border-slate-800 flex items-center gap-2 shadow-lg">
                      <span className={`w-2 h-2 rounded-full ${frameFeedback?.valid ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                      <span className="font-semibold text-[10px]">{frameFeedback?.valid ? 'High Quality Frame' : 'Aligning Face'}</span>
                    </div>

                    {frameFeedback?.sharpness !== undefined && (
                      <div className="bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full text-slate-300 border border-slate-800 font-mono text-[10px] shadow-lg">
                        Sharpness: <span className="text-indigo-400 font-bold">{frameFeedback.sharpness}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Step Guide Prompt */}
            {samples.length < 3 && (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                    <StepIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{steps[currentStep]?.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{steps[currentStep]?.desc}</div>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleCaptureSample}
                  disabled={!cameraActive}
                  variant={frameFeedback?.valid ? "glow" : "primary"}
                  size="sm"
                  icon={Camera}
                  className="shrink-0"
                >
                  Capture Sample {samples.length + 1} of 3
                </Button>
              </div>
            )}

            {/* Captured Samples Strip */}
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>Captured Samples ({samples.length}/3 required)</span>
                <span className="text-[11px] text-slate-500 lowercase">3 angles for robust recognition</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((idx) => {
                  const sampleImg = samples[idx];
                  return (
                    <div 
                      key={idx}
                      className={`relative aspect-video rounded-2xl border overflow-hidden flex items-center justify-center transition ${
                        sampleImg 
                          ? 'border-indigo-500/40 bg-slate-900 shadow-md' 
                          : 'border-slate-800 border-dashed bg-slate-950/40'
                      }`}
                    >
                      {sampleImg ? (
                        <>
                          <img src={sampleImg} alt={`Sample ${idx+1}`} className="w-full h-full object-cover transform -scale-x-100" />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur text-[9px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
                            Sample {idx + 1}
                          </div>
                          <button
                            onClick={() => handleRetakeSample(idx)}
                            title="Retake sample"
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-950/80 hover:bg-rose-600/90 text-white transition shadow"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center text-slate-600 p-2">
                          <Fingerprint className="w-5 h-5 mx-auto mb-1 opacity-30 text-slate-400" />
                          <span className="text-[10px] font-medium text-slate-500">Sample {idx + 1}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Complete Registration Action */}
            {samples.length >= 3 && (
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={handleEnrollSubmit}
                  disabled={submitting}
                  loading={submitting}
                  variant="glow"
                  className="w-full py-3 h-11 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25"
                  icon={Sparkles}
                >
                  {submitting ? 'Generating 128-d Embeddings...' : 'Enroll Face & Activate Biometrics'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

