import { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Grid3x3, LogOut } from 'lucide-react';
import { Button } from '../common/Button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface CameraViewProps {
  onPhotoCaptured: (photo: File) => void;
  onClose?: () => void;
}

export function CameraView({ onPhotoCaptured, onClose }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string>('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [initialDistance, setInitialDistance] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState(1);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getDistance = (touches: TouchList) => {
      const touch1 = touches[0];
      const touch2 = touches[1];
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const distance = getDistance(e.touches);
        setInitialDistance(distance);
        setInitialZoom(zoom);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance !== null) {
        e.preventDefault();
        const distance = getDistance(e.touches);
        const scale = distance / initialDistance;
        const newZoom = Math.min(Math.max(initialZoom * scale, 1), 4);
        setZoom(newZoom);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        setInitialDistance(null);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.min(Math.max(zoom + delta, 1), 4);
      setZoom(newZoom);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [zoom, initialDistance, initialZoom]);

  const startCamera = async () => {
    try {
      setError('');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setHasPermission(false);
      setError('No se pudo acceder a la cámara. Por favor, verifica los permisos.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    setShowFlash(true);

    setTimeout(() => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (!context) return;

      context.save();
      context.translate(canvas.width / 2, canvas.height / 2);
      context.scale(zoom, zoom);
      context.translate(-canvas.width / 2, -canvas.height / 2);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.restore();

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `photo-${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });

          setTimeout(() => {
            setShowFlash(false);
            onPhotoCaptured(file);
          }, 400);
        }
      }, 'image/jpeg', 0.95);
    }, 150);
  };

  const openGallery = () => {
    navigate('/gallery');
  };

  const openPhoneGallery = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        onPhotoCaptured(file);
      }
    };
    input.click();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (hasPermission === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Camera className="w-16 h-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Acceso a la cámara denegado
        </h3>
        <p className="text-gray-600 mb-4">
          Para tomar fotos, necesitas permitir el acceso a la cámara en la configuración de tu navegador.
        </p>
        <Button onClick={startCamera} variant="primary">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden touch-none">
      {showFlash && (
        <div className="absolute inset-0 bg-white z-30 animate-flash pointer-events-none" />
      )}

      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-auto">
        <div className="bg-gradient-to-b from-black/60 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">Reporta</h1>
              {user && <p className="text-xs text-white/80">{user.full_name}</p>}
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-white/80 hover:text-white transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-100"
        style={{ transform: `scale(${zoom})` }}
      />

      <canvas ref={canvasRef} className="hidden" />

      {error && (
        <div className="absolute top-32 left-4 right-4 bg-red-500 text-white p-3 rounded-lg text-sm z-20">
          {error}
        </div>
      )}

      <div className="absolute bottom-6 left-0 right-0 z-20 px-6 pointer-events-auto">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <button
            onClick={openPhoneGallery}
            className="p-4 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/40 transition-colors"
            title="Abrir galería del celular"
          >
            <ImageIcon className="w-6 h-6 text-white" />
          </button>

          <button
            onClick={capturePhoto}
            className="w-16 h-16 rounded-full border-4 border-white bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors flex items-center justify-center shadow-lg"
          >
            <div className="w-12 h-12 rounded-full bg-white" />
          </button>

          <button
            onClick={openGallery}
            className="p-4 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/40 transition-colors"
            title="Ver galería de reportes"
          >
            <Grid3x3 className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
