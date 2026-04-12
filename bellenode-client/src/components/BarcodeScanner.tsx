import { useEffect, useRef, useState } from 'react';
import type { ScanModeString } from '../types';

interface Props {
  mode: ScanModeString;
  onModeChange: (m: ScanModeString) => void;
  onDetect: (code: string) => void;
  onClose: () => void;
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'codabar', 'itf'];

export default function BarcodeScanner({ mode, onModeChange, onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastDetected = useRef<Map<string, number>>(new Map());
  const [supported, setSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Array<{ code: string; time: number }>>([]);
  const [flash, setFlash] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  useEffect(() => {
    const BD = (window as any).BarcodeDetector;
    if (!BD) {
      setSupported(false);
      return;
    }
    setSupported(true);

    let cancelled = false;
    let detector: any;
    let intervalId: number | null = null;

    async function start() {
      try {
        detector = new BD({ formats: FORMATS });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        const caps: any = track.getCapabilities ? track.getCapabilities() : {};
        if (caps && 'torch' in caps) setTorchAvailable(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        intervalId = window.setInterval(async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0) {
              const now = Date.now();
              for (const c of codes) {
                const raw = c.rawValue as string;
                if (!raw) continue;
                const last = lastDetected.current.get(raw) ?? 0;
                if (now - last < 2000) continue;
                lastDetected.current.set(raw, now);
                onDetect(raw);
                setRecent((prev) => [{ code: raw, time: now }, ...prev.slice(0, 4)]);
                setFlash(true);
                setTimeout(() => setFlash(false), 150);
                navigator.vibrate?.(60);
                beep();
              }
            }
          } catch {
            // ignore transient errors
          }
        }, 250);
      } catch (e: any) {
        console.error(e);
        const msg = e?.name === 'NotAllowedError'
          ? "Permission caméra refusée. Active-la dans les paramètres du navigateur."
          : e?.name === 'NotFoundError'
          ? "Aucune caméra trouvée sur cet appareil."
          : e?.message || 'Erreur caméra.';
        setError(msg);
      }
    }

    start();

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [onDetect]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
      setTorchOn(!torchOn);
    } catch (e) {
      console.error('Torch non supportée', e);
    }
  }

  if (supported === null) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <div className="text-gray-400">Initialisation...</div>
      </div>
    );
  }

  if (supported === false) {
    return (
      <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
        <div className="card p-5 max-w-sm space-y-3">
          <h3 className="font-bold text-lg">Scanner caméra non supporté</h3>
          <p className="text-sm text-gray-400">
            Ce navigateur ne supporte pas la détection de codes-barres via caméra (API
            <code className="text-gray-300"> BarcodeDetector</code>).
          </p>
          <p className="text-sm text-gray-400">
            <strong className="text-gray-200">Utilise Chrome sur Android</strong> (ou Edge, Samsung
            Internet). Safari iOS ne supporte pas encore cette API.
          </p>
          <p className="text-sm text-gray-500">
            Alternative: scanner Bluetooth branché comme clavier USB.
          </p>
          <button onClick={onClose} className="btn btn-primary w-full">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 overflow-hidden">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Viseur overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`w-4/5 max-w-md h-40 border-2 rounded-lg transition-colors ${
            flash ? 'border-green-400' : 'border-accent'
          }`}
          style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }}
        />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 p-3 flex items-center gap-2 z-10">
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="w-11 h-11 rounded-full bg-black/70 backdrop-blur text-white flex items-center justify-center text-2xl active:bg-bg-elevated"
        >
          ×
        </button>
        {torchAvailable && (
          <button
            onClick={toggleTorch}
            aria-label="Lampe"
            className={`w-11 h-11 rounded-full backdrop-blur flex items-center justify-center text-xl ${
              torchOn ? 'bg-yellow-500 text-black' : 'bg-black/70 text-white'
            }`}
          >
            {torchOn ? '💡' : '🔦'}
          </button>
        )}
        <div className="ml-auto card bg-black/70 backdrop-blur px-3 py-1 text-xs text-gray-200">
          Mode actif: <strong className="text-white">{mode}</strong>
        </div>
      </div>

      {/* Mode switcher */}
      <div className="absolute inset-x-0 top-20 flex justify-center px-4 z-10">
        <div className="flex gap-2 bg-black/70 backdrop-blur rounded-lg p-1">
          <ModeBtn active={mode === '+'} onClick={() => onModeChange('+')} color="bg-green-600">
            + Ajouter
          </ModeBtn>
          <ModeBtn active={mode === '-'} onClick={() => onModeChange('-')} color="bg-red-600">
            − Retirer
          </ModeBtn>
          <ModeBtn active={mode === '='} onClick={() => onModeChange('=')} color="bg-accent">
            = Fixer
          </ModeBtn>
        </div>
      </div>

      {/* Bottom feedback */}
      <div className="absolute bottom-0 inset-x-0 p-3 space-y-2 z-10">
        {error && (
          <div className="card p-3 bg-red-900/80 backdrop-blur border-red-600/50 text-white text-sm">
            {error}
          </div>
        )}
        {recent.length === 0 && !error && (
          <div className="card p-3 bg-black/70 backdrop-blur text-center text-sm text-gray-400">
            Aligne un code-barres dans le cadre
          </div>
        )}
        {recent.map((r) => (
          <div
            key={r.time}
            className="card p-2 bg-black/70 backdrop-blur border-green-600/40 font-mono text-xs text-green-300 flex items-center gap-2"
          >
            <span className="text-green-400">✓</span>
            <span className="flex-1 truncate">{r.code}</span>
            <span className="text-gray-500 text-[10px]">
              {new Date(r.time).toLocaleTimeString('fr-CA')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 h-10 rounded-md text-sm font-bold transition-colors ${
        active ? `${color} text-white` : 'bg-transparent text-gray-400 active:bg-bg-elevated'
      }`}
    >
      {children}
    </button>
  );
}

function beep() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
    setTimeout(() => ctx.close().catch(() => {}), 200);
  } catch {
    // ignore
  }
}
