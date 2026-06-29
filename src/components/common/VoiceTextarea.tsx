import { useState, useEffect, TextareaHTMLAttributes, useRef } from 'react';
import { X, Check, Plus, Replace } from 'lucide-react';
import { VoiceButton } from './VoiceButton';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';
import { Button } from './Button';

type ApplyMode = 'replace' | 'append' | 'insert';

interface VoiceTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function VoiceTextarea({ value, onChange, label, className = '', ...props }: VoiceTextareaProps) {
  const {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceRecognition();

  const [showModal, setShowModal] = useState(false);
  const [applyMode, setApplyMode] = useState<ApplyMode>('append');
  const [editedTranscript, setEditedTranscript] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  useEffect(() => {
    const savedMode = localStorage.getItem('voiceTextareaMode') as ApplyMode;
    if (savedMode) {
      setApplyMode(savedMode);
    }
  }, []);

  useEffect(() => {
    if (isListening) {
      setShowModal(true);
    }
  }, [isListening]);

  useEffect(() => {
    setEditedTranscript(transcript);
  }, [transcript]);

  const handleStartVoice = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
    startListening();
  };

  const handleStopVoice = () => {
    stopListening();
  };

  const applyTranscript = () => {
    const finalText = editedTranscript.trim();
    if (!finalText) return;

    let newValue = '';

    switch (applyMode) {
      case 'replace':
        newValue = finalText;
        break;
      case 'append':
        newValue = value ? `${value} ${finalText}` : finalText;
        break;
      case 'insert':
        const before = value.slice(0, cursorPosition);
        const after = value.slice(cursorPosition);
        newValue = `${before}${finalText}${after}`;
        break;
    }

    onChange(newValue);
    handleCancel();
  };

  const handleCancel = () => {
    stopListening();
    setShowModal(false);
    resetTranscript();
    setEditedTranscript('');
  };

  const handleModeChange = (mode: ApplyMode) => {
    setApplyMode(mode);
    localStorage.setItem('voiceTextareaMode', mode);
  };

  const fullTranscript = editedTranscript + (interimTranscript ? ` ${interimTranscript}` : '');

  return (
    <div className="relative">
      {label && (
        <label className="text-white/80 text-sm mb-2 block flex items-center justify-between">
          <span>{label}</span>
        </label>
      )}

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
          {...props}
        />

        {isSupported && (
          <div className="absolute top-2 right-2">
            <VoiceButton
              isListening={isListening}
              isSupported={isSupported}
              onClick={isListening ? handleStopVoice : handleStartVoice}
            />
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full border border-white/10">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  {isListening ? (
                    <>
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      Escuchando...
                    </>
                  ) : (
                    'Editar transcripción'
                  )}
                </h3>
                <button
                  onClick={handleCancel}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label className="text-white/80 text-sm mb-2 block">Modo de aplicación</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleModeChange('replace')}
                    className={`p-3 rounded-lg text-white transition-all flex flex-col items-center gap-1 ${
                      applyMode === 'replace'
                        ? 'bg-cyan-600 ring-2 ring-cyan-400'
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    <Replace className="w-5 h-5" />
                    <span className="text-xs">Reemplazar</span>
                  </button>
                  <button
                    onClick={() => handleModeChange('append')}
                    className={`p-3 rounded-lg text-white transition-all flex flex-col items-center gap-1 ${
                      applyMode === 'append'
                        ? 'bg-cyan-600 ring-2 ring-cyan-400'
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-xs">Agregar</span>
                  </button>
                  <button
                    onClick={() => handleModeChange('insert')}
                    className={`p-3 rounded-lg text-white transition-all flex flex-col items-center gap-1 ${
                      applyMode === 'insert'
                        ? 'bg-cyan-600 ring-2 ring-cyan-400'
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    <Plus className="w-5 h-5 rotate-90" />
                    <span className="text-xs">Insertar</span>
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-white/80 text-sm mb-2 block">Transcripción</label>
                <textarea
                  value={editedTranscript}
                  onChange={(e) => setEditedTranscript(e.target.value)}
                  className="w-full h-40 p-4 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-white/15 focus:border-cyan-400 resize-none"
                  placeholder="El texto que digas aparecerá aquí..."
                  disabled={isListening}
                />
                {interimTranscript && (
                  <div className="mt-2 p-3 bg-cyan-500/20 border border-cyan-500/50 rounded-lg">
                    <p className="text-cyan-200 text-sm italic">{interimTranscript}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                {isListening ? (
                  <Button
                    onClick={handleStopVoice}
                    variant="danger"
                    size="lg"
                    className="flex-1"
                  >
                    Detener grabación
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleCancel}
                      variant="secondary"
                      size="lg"
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={applyTranscript}
                      variant="success"
                      size="lg"
                      className="flex-1 flex items-center justify-center gap-2"
                      disabled={!fullTranscript.trim()}
                    >
                      <Check className="w-5 h-5" />
                      Aplicar
                    </Button>
                  </>
                )}
              </div>

              {!isListening && !error && fullTranscript && (
                <p className="mt-3 text-white/60 text-xs text-center">
                  Puedes editar el texto antes de aplicarlo
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
