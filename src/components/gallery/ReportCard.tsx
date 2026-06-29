import { Report } from '../../types/database';
import { formatDate, getStatusLabel, getStatusColor, getPriorityColor, getPriorityLabel, getTypeLabel, getClosureDateStatus, getClosureDateMessage } from '../../utils/format';
import { Camera, AlertTriangle, Clock } from 'lucide-react';

interface ReportCardProps {
  report: Report;
  onClick: () => void;
}

export function ReportCard({ report, onClick }: ReportCardProps) {
  const mainPhoto = report.photos?.find((p) => p.is_main) || report.photos?.[0];
  const photoCount = report.photos?.length || 0;
  const closureDateStatus = getClosureDateStatus(report.proposed_closure_date, report.status);
  const closureDateMessage = getClosureDateMessage(report.proposed_closure_date, report.status);

  return (
    <div
      onClick={onClick}
      className="relative aspect-square bg-gray-200 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group"
    >
      {mainPhoto ? (
        <img
          src={mainPhoto.photo_url}
          alt="Report"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <Camera className="w-8 h-8 text-gray-400" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />

      {photoCount > 1 && (
        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1 font-medium">
          <Camera className="w-3 h-3" />
          {photoCount}
        </div>
      )}

      {closureDateStatus === 'overdue' && (
        <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1 font-medium shadow-lg animate-pulse">
          <AlertTriangle className="w-3 h-3" />
          <span className="hidden sm:inline">{closureDateMessage}</span>
        </div>
      )}

      {closureDateStatus === 'soon' && (
        <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1 font-medium shadow-lg">
          <Clock className="w-3 h-3" />
          <span className="hidden sm:inline">{closureDateMessage}</span>
        </div>
      )}

      <div className={`absolute bottom-2 left-2 ${getStatusColor(report.status)} text-white text-xs px-2.5 py-1 rounded font-medium shadow-lg`}>
        {getStatusLabel(report.status)}
      </div>
    </div>
  );
}
