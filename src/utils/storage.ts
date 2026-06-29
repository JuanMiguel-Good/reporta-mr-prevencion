import { supabase } from '../lib/supabase';

export async function uploadPhoto(
  file: File,
  companyId: string,
  reportId: string,
  _isEvidence: boolean = false
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${reportId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${companyId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('report-photos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('report-photos')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function uploadVoiceNote(
  file: File,
  companyId: string,
  reportId: string
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${reportId}/${Date.now()}_voice.${fileExt}`;
  const filePath = `${companyId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('voice-notes')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('voice-notes')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function uploadEvidenceFile(
  file: File,
  companyId: string,
  reportId: string
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${reportId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${companyId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('report-photos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('report-photos')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export async function downloadImageFromStorage(photoUrl: string): Promise<ArrayBuffer | null> {
  try {
    const url = new URL(photoUrl);
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/report-photos\/(.+)$/);

    if (!pathMatch) {
      console.error('Could not extract file path from URL:', photoUrl);
      return null;
    }

    const filePath = pathMatch[1];

    const { data, error } = await supabase.storage
      .from('report-photos')
      .download(filePath);

    if (error) {
      console.error('Error downloading from Supabase Storage:', error);
      return null;
    }

    if (!data) {
      console.error('No data received from Supabase Storage');
      return null;
    }

    return await data.arrayBuffer();
  } catch (error) {
    console.error('Error in downloadImageFromStorage:', error);
    return null;
  }
}

export function compressImage(file: File, maxWidth: number = 1920): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}
