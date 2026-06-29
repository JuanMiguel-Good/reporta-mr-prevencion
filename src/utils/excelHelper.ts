import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { downloadImageFromStorage } from './storage';

export interface UserRow {
  email?: string;
  dni: string;
  full_name: string;
  role: 'worker' | 'sst_manager' | 'hr_observer';
  area?: string;
  proyecto?: string;
  password?: string;
  can_close_reports?: boolean;
}

const roleMapping: Record<string, 'worker' | 'sst_manager' | 'hr_observer'> = {
  'trabajador': 'worker',
  'gestor_sst': 'sst_manager',
  'rrhh_observador': 'hr_observer',
  'worker': 'worker',
  'sst_manager': 'sst_manager',
  'hr_observer': 'hr_observer',
};

export function downloadTemplate() {
  const template = [
    {
      'DNI (Obligatorio)': '12345678',
      'Nombre Completo (Obligatorio)': 'Juan Pérez',
      'Rol (Obligatorio)': 'trabajador',
      'Email (Opcional)': 'usuario@ejemplo.com',
      'Área (Opcional)': 'Producción',
      'Proyecto (Opcional)': 'Proyecto A',
      'Puede Cerrar Reportes (Opcional)': 'NO',
      'Contraseña (Opcional)': '',
    },
    {
      'DNI (Obligatorio)': '87654321',
      'Nombre Completo (Obligatorio)': 'María García',
      'Rol (Obligatorio)': 'trabajador',
      'Email (Opcional)': 'maria@ejemplo.com',
      'Área (Opcional)': 'Logística',
      'Proyecto (Opcional)': 'Proyecto B',
      'Puede Cerrar Reportes (Opcional)': 'SI',
      'Contraseña (Opcional)': 'password123',
    },
    {
      'DNI (Obligatorio)': '11223344',
      'Nombre Completo (Obligatorio)': 'Carlos López',
      'Rol (Obligatorio)': 'gestor_sst',
      'Email (Opcional)': 'carlos@ejemplo.com',
      'Área (Opcional)': 'Seguridad',
      'Proyecto (Opcional)': 'Proyecto C',
      'Puede Cerrar Reportes (Opcional)': 'SI',
      'Contraseña (Opcional)': '',
    },
    {
      'DNI (Obligatorio)': '44556677',
      'Nombre Completo (Obligatorio)': 'Ana Martínez',
      'Rol (Obligatorio)': 'rrhh_observador',
      'Email (Opcional)': 'ana@ejemplo.com',
      'Área (Opcional)': 'Recursos Humanos',
      'Proyecto (Opcional)': 'Proyecto D',
      'Puede Cerrar Reportes (Opcional)': 'NO',
      'Contraseña (Opcional)': '',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(template);

  worksheet['!cols'] = [
    { wch: 18 },
    { wch: 30 },
    { wch: 20 },
    { wch: 25 },
    { wch: 20 },
    { wch: 20 },
    { wch: 30 },
    { wch: 22 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuarios');

  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    ['INSTRUCCIONES PARA CARGA MASIVA DE USUARIOS'],
    [''],
    ['CAMPOS OBLIGATORIOS:'],
    ['• DNI: Número de documento de identidad (mínimo 5 caracteres)'],
    ['• Nombre Completo: Nombre completo del usuario (mínimo 3 caracteres)'],
    ['• Rol: Rol del usuario en el sistema'],
    [''],
    ['ROLES VÁLIDOS (escribe exactamente uno de estos):'],
    ['• trabajador - Para trabajadores regulares'],
    ['• gestor_sst - Para gestores de SST'],
    ['• rrhh_observador - Para personal de RRHH/Observadores'],
    [''],
    ['CAMPOS OPCIONALES:'],
    ['• Email: Correo electrónico (si no se proporciona, el usuario solo podrá iniciar sesión con DNI)'],
    ['• Área: Área de trabajo'],
    ['• Proyecto: Proyecto asignado'],
    ['• Puede Cerrar Reportes: SI o NO (indica si el usuario puede ser asignado como responsable de cierre)'],
    ['  - SI: El usuario puede ser asignado para subir evidencias de cierre'],
    ['  - NO o vacío: El usuario NO puede ser asignado como responsable de cierre'],
    ['• Contraseña: Si no se proporciona, la contraseña será el DNI del usuario'],
    [''],
    ['IMPORTANTE:'],
    ['• No modifiques los encabezados de las columnas'],
    ['• No dejes filas vacías entre usuarios'],
    ['• Revisa que los roles estén escritos correctamente (en minúsculas y con guión bajo)'],
    ['• "Puede Cerrar Reportes" debe ser exactamente "SI" o "NO" (mayúsculas)'],
  ]);

  instructionsSheet['!cols'] = [{ wch: 80 }];

  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instrucciones');

  XLSX.writeFile(workbook, 'plantilla_usuarios.xlsx');
}

export async function parseExcelFile(file: File): Promise<UserRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, {
          raw: false,
          defval: '',
        });

        const users: UserRow[] = jsonData
          .filter((row: any) => {
            const dni = row['DNI (Obligatorio)'] || row['dni'] || row['DNI'];
            const full_name = row['Nombre Completo (Obligatorio)'] || row['full_name'] || row['Nombre Completo'];
            const role = row['Rol (Obligatorio)'] || row['role'] || row['Rol'];
            return dni && full_name && role;
          })
          .map((row: any) => {
            const dni = String(row['DNI (Obligatorio)'] || row['dni'] || row['DNI'] || '').trim();
            const full_name = String(row['Nombre Completo (Obligatorio)'] || row['full_name'] || row['Nombre Completo'] || '').trim();
            const roleInput = String(row['Rol (Obligatorio)'] || row['role'] || row['Rol'] || '').trim().toLowerCase();
            const email = row['Email (Opcional)'] || row['email'] || row['Email'];
            const area = row['Área (Opcional)'] || row['area'] || row['Área'];
            const proyecto = row['Proyecto (Opcional)'] || row['proyecto'] || row['Proyecto'];
            const password = row['Contraseña (Opcional)'] || row['password'] || row['Contraseña'];
            const canCloseReportsInput = String(row['Puede Cerrar Reportes (Opcional)'] || row['can_close_reports'] || row['Puede Cerrar Reportes'] || '').trim().toUpperCase();

            const mappedRole = roleMapping[roleInput] || roleInput;
            const canCloseReports = canCloseReportsInput === 'SI' || canCloseReportsInput === 'YES' || canCloseReportsInput === 'TRUE' || canCloseReportsInput === '1';

            return {
              dni,
              full_name,
              role: mappedRole as UserRow['role'],
              email: email ? String(email).trim() : undefined,
              area: area ? String(area).trim() : undefined,
              proyecto: proyecto ? String(proyecto).trim() : undefined,
              password: password ? String(password).trim() : undefined,
              can_close_reports: canCloseReports,
            };
          });

        resolve(users);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo'));
    };

    reader.readAsBinaryString(file);
  });
}

export function validateUserRow(row: UserRow, index: number): string | null {
  const validRoles = ['worker', 'sst_manager', 'hr_observer'];

  if (!row.dni || row.dni.length < 5) {
    return `Fila ${index + 1}: DNI inválido (obligatorio, mínimo 5 caracteres)`;
  }

  if (!row.full_name || row.full_name.length < 3) {
    return `Fila ${index + 1}: Nombre completo inválido (obligatorio, mínimo 3 caracteres)`;
  }

  if (!validRoles.includes(row.role)) {
    return `Fila ${index + 1}: Rol inválido (obligatorio). Debe ser: trabajador, gestor_sst o rrhh_observador`;
  }

  if (row.email && row.email.trim() !== '' && !row.email.includes('@')) {
    return `Fila ${index + 1}: Email con formato inválido`;
  }

  if (row.password && row.password.length < 6) {
    return `Fila ${index + 1}: La contraseña debe tener al menos 6 caracteres`;
  }

  return null;
}

export function exportMetricsToExcel(data: any, startDate: Date, endDate: Date) {
  const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente',
    in_progress: 'En Proceso',
    resolved: 'Resuelto',
    closed: 'Cerrado'
  };

  const PRIORITY_LABELS: Record<string, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    critical: 'Crítica'
  };

  const TYPE_LABELS: Record<string, string> = {
    unsafe_act: 'Actos Inseguros',
    unsafe_condition: 'Condiciones Inseguras'
  };

  const summaryData = [
    { Métrica: 'Total de Reportes', Valor: data.totalReports },
    { Métrica: 'Reportes Cerrados', Valor: data.resolvedReports },
    { Métrica: 'Reportes Pendientes', Valor: data.pendingReports },
    { Métrica: 'Tasa de Resolución (%)', Valor: data.totalReports > 0 ? ((data.resolvedReports / data.totalReports) * 100).toFixed(2) : 0 },
    { Métrica: 'Tiempo Promedio de Resolución (días)', Valor: data.averageResolutionDays.toFixed(1) },
    { Métrica: 'Comparación Período Anterior (%)', Valor: data.previousPeriodComparison.toFixed(1) },
  ];

  const statusData = data.reportsByStatus.map((item: any) => ({
    Estado: STATUS_LABELS[item.status] || item.status,
    Cantidad: item.count,
    Porcentaje: `${item.percentage.toFixed(1)}%`
  }));

  const priorityData = data.reportsByPriority.map((item: any) => ({
    'Nivel de Riesgo': PRIORITY_LABELS[item.priority] || item.priority,
    Cantidad: item.count,
    Porcentaje: `${item.percentage.toFixed(1)}%`
  }));

  const typeData = data.reportsByType.map((item: any) => ({
    Tipo: TYPE_LABELS[item.type] || item.type,
    Cantidad: item.count
  }));

  const categoryData = data.reportsByCategory.map((item: any) => ({
    Categoría: item.category,
    Cantidad: item.count
  }));

  const areaData = data.reportsByArea.map((item: any) => ({
    Área: item.area,
    Cantidad: item.count
  }));

  const reportersData = data.topReporters.map((item: any, index: number) => ({
    Posición: index + 1,
    Usuario: item.user,
    'Reportes Creados': item.count
  }));

  const responsiblesData = data.topResponsibles.map((item: any) => ({
    Usuario: item.user,
    'Total Asignados': item.count,
    'Pendientes': item.pending
  }));

  const timelineData = data.timeline.map((item: any) => ({
    Fecha: item.date,
    Total: item.count,
    'Actos Inseguros': item.unsafe_acts,
    'Condiciones Inseguras': item.unsafe_conditions
  }));

  const workbook = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 40 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

  const statusSheet = XLSX.utils.json_to_sheet(statusData);
  statusSheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, statusSheet, 'Por Estado');

  const prioritySheet = XLSX.utils.json_to_sheet(priorityData);
  prioritySheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, prioritySheet, 'Por Nivel de Riesgo');

  const typeSheet = XLSX.utils.json_to_sheet(typeData);
  typeSheet['!cols'] = [{ wch: 30 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, typeSheet, 'Por Tipo');

  const categorySheet = XLSX.utils.json_to_sheet(categoryData);
  categorySheet['!cols'] = [{ wch: 30 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, categorySheet, 'Por Categoría');

  if (areaData.length > 0) {
    const areaSheet = XLSX.utils.json_to_sheet(areaData);
    areaSheet['!cols'] = [{ wch: 30 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, areaSheet, 'Por Área');
  }

  const reportersSheet = XLSX.utils.json_to_sheet(reportersData);
  reportersSheet['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, reportersSheet, 'Top Reportadores');

  const responsiblesSheet = XLSX.utils.json_to_sheet(responsiblesData);
  responsiblesSheet['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, responsiblesSheet, 'Responsables');

  const timelineSheet = XLSX.utils.json_to_sheet(timelineData);
  timelineSheet['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(workbook, timelineSheet, 'Línea de Tiempo');

  const fileName = `metricas_${startDate.toISOString().split('T')[0]}_a_${endDate.toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

async function downloadImageWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<ArrayBuffer | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const arrayBuffer = await downloadImageFromStorage(url);

      if (!arrayBuffer) {
        console.warn(`Download attempt ${attempt}/${maxRetries} returned null for ${url}`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return null;
      }

      console.log(`Successfully downloaded image: ${url.substring(url.lastIndexOf('/') + 1)}`);
      return arrayBuffer;

    } catch (error) {
      console.warn(`Download attempt ${attempt}/${maxRetries} failed for ${url}:`, error);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else {
        console.error(`All ${maxRetries} attempts failed for image: ${url}`);
        return null;
      }
    }
  }
  return null;
}

async function downloadImagesInBatches(
  urls: string[],
  batchSize: number = 3,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, ArrayBuffer>> {
  const results = new Map<string, ArrayBuffer>();

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchPromises = batch.map(async (url) => {
      const buffer = await downloadImageWithRetry(url);
      return { url, buffer };
    });

    const batchResults = await Promise.all(batchPromises);

    for (const { url, buffer } of batchResults) {
      if (buffer) {
        results.set(url, buffer);
      }
    }

    if (onProgress) {
      onProgress(Math.min(i + batchSize, urls.length), urls.length);
    }

    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

function getImageExtension(url: string): string {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.png')) return 'png';
  if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg')) return 'jpeg';
  if (lowerUrl.includes('.gif')) return 'gif';
  return 'jpeg';
}

export async function exportReportsToExcel(
  reports: any[],
  onProgress?: (message: string, current: number, total: number) => void
) {
  const STATUS_LABELS: Record<string, string> = {
    reported: 'Reportado',
    assigned: 'Asignado',
    in_review: 'En Revisión',
    evidence_rejected: 'Evidencia Rechazada',
    closed: 'Cerrado'
  };

  const PRIORITY_LABELS: Record<string, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    critical: 'Crítica'
  };

  const TYPE_LABELS: Record<string, string> = {
    unsafe_act: 'Acto Inseguro',
    unsafe_condition: 'Condición Insegura'
  };

  const maxReportPhotos = Math.max(
    ...reports.map(r => (r.photos || []).filter((p: any) => !p.is_evidence).length),
    1
  );
  const maxEvidencePhotos = Math.max(
    ...reports.map(r => (r.photos || []).filter((p: any) => p.is_evidence).length),
    1
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema Reporta';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Resumen');
  const reportsSheet = workbook.addWorksheet('Reportes');

  const summaryData = [
    ['Total de Reportes', reports.length],
    ['Reportados', reports.filter(r => r.status === 'reported').length],
    ['Asignados', reports.filter(r => r.status === 'assigned').length],
    ['En Revisión', reports.filter(r => r.status === 'in_review').length],
    ['Evidencia Rechazada', reports.filter(r => r.status === 'evidence_rejected').length],
    ['Cerrados', reports.filter(r => r.status === 'closed').length],
    ['', ''],
    ['Riesgo Bajo', reports.filter(r => r.priority === 'low').length],
    ['Riesgo Medio', reports.filter(r => r.priority === 'medium').length],
    ['Riesgo Alto', reports.filter(r => r.priority === 'high').length],
    ['Riesgo Crítico', reports.filter(r => r.priority === 'critical').length],
    ['', ''],
    ['Actos Inseguros', reports.filter(r => r.type === 'unsafe_act').length],
    ['Condiciones Inseguras', reports.filter(r => r.type === 'unsafe_condition').length],
  ];

  summarySheet.columns = [
    { header: 'Métrica', key: 'metric', width: 30 },
    { header: 'Valor', key: 'value', width: 15 },
  ];
  summaryData.forEach(row => summarySheet.addRow(row));

  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  const baseColumns: any[] = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Fecha Creación', key: 'created_at', width: 18 },
    { header: 'Estado', key: 'status', width: 18 },
    { header: 'Tipo', key: 'type', width: 18 },
    { header: 'Nivel de Riesgo', key: 'priority', width: 15 },
    { header: 'Categoría', key: 'category', width: 25 },
    { header: 'Área', key: 'area', width: 20 },
    { header: 'Proyecto', key: 'proyecto', width: 20 },
    { header: 'Reportado por', key: 'reporter', width: 25 },
    { header: 'Asignado a', key: 'assigned_to', width: 25 },
    { header: 'Descripción', key: 'description', width: 50 },
    { header: 'Cierre Propuesto', key: 'proposed_closure', width: 50 },
    { header: 'Fecha Propuesta Cierre', key: 'proposed_closure_date', width: 18 },
    { header: 'Motivo Rechazo', key: 'rejection_reason', width: 40 },
    { header: 'Fecha Cierre', key: 'closed_at', width: 18 },
    { header: 'Cerrado por', key: 'closed_by', width: 25 },
    { header: 'Dirección', key: 'location_address', width: 40 },
    { header: 'Coordenadas', key: 'coordinates', width: 30 },
    { header: 'Análisis IA', key: 'ai_analysis', width: 12 },
    { header: 'Confianza IA', key: 'ai_confidence', width: 15 },
  ];

  for (let i = 1; i <= maxReportPhotos; i++) {
    baseColumns.push({ header: `Foto Reporte ${i}`, key: `report_photo_${i}`, width: 20 });
  }

  for (let i = 1; i <= maxEvidencePhotos; i++) {
    baseColumns.push({ header: `Foto Evidencia ${i}`, key: `evidence_photo_${i}`, width: 20 });
  }

  reportsSheet.columns = baseColumns;

  reportsSheet.getRow(1).font = { bold: true };
  reportsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  const allImageUrls: string[] = [];
  reports.forEach(report => {
    const photos = report.photos || [];
    photos.forEach((photo: any) => {
      if (photo.photo_url && !allImageUrls.includes(photo.photo_url)) {
        allImageUrls.push(photo.photo_url);
      }
    });
  });

  if (onProgress) {
    onProgress('Descargando imágenes...', 0, allImageUrls.length);
  }

  const imageBuffers = await downloadImagesInBatches(
    allImageUrls,
    3,
    (current, total) => {
      if (onProgress) {
        onProgress(`Descargando imágenes (${current}/${total})...`, current, total);
      }
    }
  );

  const successCount = imageBuffers.size;
  const failedCount = allImageUrls.length - successCount;

  if (failedCount > 0) {
    console.warn(`Warning: ${failedCount} de ${allImageUrls.length} imágenes no se pudieron descargar`);
    const failedUrls = allImageUrls.filter(url => !imageBuffers.has(url));
    console.warn('URLs que fallaron:', failedUrls);
  }

  if (onProgress) {
    onProgress('Generando documento Excel...', 0, reports.length);
  }

  for (let i = 0; i < reports.length; i++) {
    const report = reports[i];
    const rowData: any = {
      id: report.id,
      created_at: new Date(report.created_at).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      status: STATUS_LABELS[report.status] || report.status,
      type: TYPE_LABELS[report.type] || report.type,
      priority: PRIORITY_LABELS[report.priority] || report.priority,
      category: report.category?.name || '-',
      area: report.area || '-',
      proyecto: report.proyecto || '-',
      reporter: report.reporter?.full_name || '-',
      assigned_to: report.assigned_to?.full_name || '-',
      description: report.description,
      proposed_closure: report.proposed_closure || '-',
      proposed_closure_date: report.proposed_closure_date
        ? new Date(report.proposed_closure_date).toLocaleDateString('es-ES')
        : '-',
      rejection_reason: report.rejection_reason || '-',
      closed_at: report.closed_at
        ? new Date(report.closed_at).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : '-',
      closed_by: report.closed_by?.full_name || '-',
      location_address: report.location_address || '-',
      coordinates: report.latitude && report.longitude
        ? `${report.latitude}, ${report.longitude}`
        : '-',
      ai_analysis: report.ai_analysis ? 'Sí' : 'No',
      ai_confidence: report.ai_confidence_score ? `${(report.ai_confidence_score * 100).toFixed(1)}%` : '-',
    };

    const row = reportsSheet.addRow(rowData);
    row.height = 120;

    const reportPhotos = (report.photos || []).filter((p: any) => !p.is_evidence);
    const evidencePhotos = (report.photos || []).filter((p: any) => p.is_evidence);

    for (let j = 0; j < reportPhotos.length; j++) {
      const photo = reportPhotos[j];
      const imageBuffer = imageBuffers.get(photo.photo_url);

      if (imageBuffer) {
        const imageId = workbook.addImage({
          buffer: imageBuffer,
          extension: getImageExtension(photo.photo_url) as any,
        });

        const colIndex = baseColumns.findIndex(c => c.key === `report_photo_${j + 1}`);

        reportsSheet.addImage(imageId, {
          tl: { col: colIndex, row: i + 1 },
          ext: { width: 100, height: 100 },
        });
      }
    }

    for (let j = 0; j < evidencePhotos.length; j++) {
      const photo = evidencePhotos[j];
      const imageBuffer = imageBuffers.get(photo.photo_url);

      if (imageBuffer) {
        const imageId = workbook.addImage({
          buffer: imageBuffer,
          extension: getImageExtension(photo.photo_url) as any,
        });

        const colIndex = baseColumns.findIndex(c => c.key === `evidence_photo_${j + 1}`);

        reportsSheet.addImage(imageId, {
          tl: { col: colIndex, row: i + 1 },
          ext: { width: 100, height: 100 },
        });
      }
    }

    if (onProgress && i % 5 === 0) {
      onProgress(`Generando Excel (${i + 1}/${reports.length})...`, i + 1, reports.length);
    }
  }

  if (onProgress) {
    onProgress('Finalizando...', reports.length, reports.length);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reportes_${new Date().toISOString().split('T')[0]}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);

  return {
    totalReports: reports.length,
    totalImages: allImageUrls.length,
    successfulImages: successCount,
    failedImages: failedCount
  };
}
