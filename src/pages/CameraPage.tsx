import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraView } from '../components/camera/CameraView';
import { ReportFlow } from '../components/camera/ReportFlow';
import { IntelligentReportFlow } from '../components/camera/IntelligentReportFlow';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { uploadPhoto, compressImage } from '../utils/storage';
import { ReportType, AIAnalysisResult } from '../types/database';
import { Loading } from '../components/common/Loading';
import { getAISettings } from '../utils/imageAnalysis';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { offlineStorage } from '../utils/offlineStorage';
import { useGeolocation } from '../hooks/useGeolocation';

export function CameraPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();
  const { position } = useGeolocation();

  const [capturedPhotos, setCapturedPhotos] = useState<File[]>([]);
  const [showReportFlow, setShowReportFlow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [useAIMode, setUseAIMode] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);

  useEffect(() => {
    if (user) {
      checkAIAvailability();
    }
  }, [user]);

  const checkAIAvailability = async () => {
    if (!user) {
      console.log('[WARNING] No user found, skipping AI check');
      return;
    }

    console.log('[AI Check] Checking AI availability for user:', user.email);
    const settings = await getAISettings(user.company_id);

    if (settings && settings.ai_enabled) {
      console.log('[AI Enabled] Setting AI mode to ENABLED');
      setAiEnabled(true);
      setUseAIMode(true);
    } else {
      console.log('[AI Disabled] Setting AI mode to DISABLED');
      setAiEnabled(false);
      setUseAIMode(false);
    }
  };

  const handlePhotoCaptured = (photo: File) => {
    setCapturedPhotos((prev) => [...prev, photo]);
    setShowReportFlow(true);
  };

  const handleAddMorePhotos = () => {
    setShowReportFlow(false);
  };

  const handleCancelReport = () => {
    setCapturedPhotos([]);
    setShowReportFlow(false);
    setUseAIMode(aiEnabled);
  };

  const handleSwitchToManual = () => {
    setUseAIMode(false);
  };

  const handleSubmitReport = async (data: {
    type: ReportType;
    categoryId: string;
    description: string;
    proposedClosure: string;
    priority?: string;
    area?: string;
    proyecto?: string;
    aiAnalysis?: AIAnalysisResult;
    manualOverride?: boolean;
  }) => {
    if (!user) return;

    setSubmitting(true);

    try {
      if (!isOnline) {
        const reportId = `offline_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const compressedPhotos = await Promise.all(
          capturedPhotos.map(photo => compressImage(photo))
        );

        await offlineStorage.saveReport({
          id: reportId,
          title: data.proposedClosure,
          description: data.description,
          category_id: data.categoryId,
          location: position ? `${position.latitude}, ${position.longitude}` : 'Sin ubicación',
          latitude: position?.latitude || null,
          longitude: position?.longitude || null,
          area_proyecto: data.area || data.proyecto || '',
          proposed_closure_date: null,
          photos: compressedPhotos.map((_, i) => `photo_${i}`),
          created_at: new Date().toISOString(),
          synced: false,
        });

        for (let i = 0; i < compressedPhotos.length; i++) {
          await offlineStorage.savePhoto({
            id: `${reportId}_photo_${i}`,
            report_id: reportId,
            blob: compressedPhotos[i],
            created_at: new Date().toISOString(),
          });
        }

        setCapturedPhotos([]);
        setShowReportFlow(false);
        alert('Reporte guardado. Se enviará automáticamente cuando tengas conexión.');
        navigate('/gallery');
        return;
      }

      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert({
          company_id: user.company_id,
          reporter_id: user.id,
          type: data.type,
          category_id: data.categoryId,
          description: data.description,
          area: data.area || null,
          proyecto: data.proyecto || null,
          status: 'reported',
          priority: data.priority || data.aiAnalysis?.priority || 'medium',
          ai_analysis: data.aiAnalysis || null,
          ai_confidence_score: data.aiAnalysis?.confidence || null,
        })
        .select()
        .single();

      if (reportError) throw reportError;

      const photoUrls: string[] = [];
      for (let i = 0; i < capturedPhotos.length; i++) {
        const photo = capturedPhotos[i];
        const compressedPhoto = await compressImage(photo);
        const photoUrl = await uploadPhoto(compressedPhoto, user.company_id, report.id, false);
        photoUrls.push(photoUrl);

        await supabase.from('report_photos').insert({
          report_id: report.id,
          photo_url: photoUrl,
          is_main: i === 0,
          is_evidence: false,
          uploaded_by: user.id,
        });
      }

      if (photoUrls.length > 0) {
        await supabase
          .from('reports')
          .update({ photo_urls: photoUrls })
          .eq('id', report.id);
      }

      setCapturedPhotos([]);
      setShowReportFlow(false);
      navigate('/gallery');
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Error al enviar el reporte. Por favor intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="text-center">
          <Loading />
          <p className="text-white mt-4">
            {isOnline ? 'Enviando reporte...' : 'Guardando reporte...'}
          </p>
        </div>
      </div>
    );
  }

  if (showReportFlow && capturedPhotos.length > 0) {
    console.log('[Report Flow] Show Report Flow - useAIMode:', useAIMode, 'aiEnabled:', aiEnabled);

    if (useAIMode && aiEnabled) {
      console.log('[Intelligent Flow] Displaying INTELLIGENT REPORT FLOW');
      return (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <IntelligentReportFlow
            photos={capturedPhotos}
            onSubmit={handleSubmitReport}
            onAddMorePhotos={handleAddMorePhotos}
            onSwitchToManual={handleSwitchToManual}
            onCancel={handleCancelReport}
          />
        </div>
      );
    }

    console.log('[Manual Flow] Displaying MANUAL REPORT FLOW');
    return (
      <div className="fixed inset-0 z-50 overflow-hidden">
        <ReportFlow
          photos={capturedPhotos}
          onSubmit={handleSubmitReport}
          onAddMorePhotos={handleAddMorePhotos}
          onCancel={handleCancelReport}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" data-onboarding="camera-view">
      <CameraView onPhotoCaptured={handlePhotoCaptured} />
    </div>
  );
}
