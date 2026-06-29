import { ButtonHTMLAttributes } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isListening: boolean;
  isSupported: boolean;
}

export function VoiceButton({ isListening, isSupported, className = '', disabled, ...props }: VoiceButtonProps) {
  if (!isSupported) {
    return null;
  }

  return (
    <button
      type="button"
      className={`p-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        isListening
          ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse focus:ring-red-400'
          : 'bg-white/10 hover:bg-white/20 text-white focus:ring-cyan-400'
      } ${className}`}
      disabled={disabled}
      title={isListening ? 'Detener grabación' : 'Iniciar dictado por voz'}
      {...props}
    >
      {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
    </button>
  );
}
