import React, { useEffect, useRef } from 'react';
import { FileText, MonitorUp, Upload, X } from 'lucide-react';

export interface GyaanPatraMedia {
  kind: 'screen' | 'image' | 'pdf' | 'video';
  url?: string;
  name: string;
}

interface GyaanPatraStageProps {
  isGuru: boolean;
  screenStream: MediaStream | null;
  media: GyaanPatraMedia | null;
  onSelectLocalFile: (file: File) => void;
  onStopSharing: () => void;
}

export function GyaanPatraStage({
  isGuru,
  screenStream,
  media,
  onSelectLocalFile,
  onStopSharing,
}: GyaanPatraStageProps) {
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectLocalFile(file);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#140A24]">
      {/* Dedicated non-overlapping top header bar inside stage */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3D1F63] bg-[#1D0E30] shrink-0">
        <div className="flex items-center gap-2 text-xs text-[#FAF5EC] min-w-0">
          <MonitorUp className="w-3.5 h-3.5 text-[#F3B33D] shrink-0" />
          <span className="font-display font-medium truncate">
            Gyaan Patra {media?.name ? `· ${media.name}` : ''}
          </span>
        </div>

        {isGuru && (
          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2B1547] text-[#FAF5EC] text-xs hover:bg-[#3D1F63] cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#F3B33D]" />
              <span>PDF / Media</span>
            </button>
            <button
              type="button"
              onClick={onStopSharing}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-900/70 text-rose-100 text-xs hover:bg-rose-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Stop</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 w-full h-full min-h-0 flex items-center justify-center bg-[#0F061D]">
        {screenStream ? (
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />
        ) : media?.kind === 'image' && media.url ? (
          <img
            src={media.url}
            alt={media.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain"
          />
        ) : media?.kind === 'video' && media.url ? (
          <video
            src={media.url}
            controls
            autoPlay
            className="w-full h-full object-contain"
          />
        ) : media?.kind === 'pdf' && media.url ? (
          <iframe
            src={media.url}
            title={media.name}
            className="w-full h-full border-0 bg-white"
          />
        ) : (
          <div className="text-center p-6 max-w-sm">
            <FileText className="w-10 h-10 text-[#F3B33D] mx-auto mb-3" />
            <p className="font-display text-lg text-[#FAF5EC] mb-1">Gyaan Patra Stage</p>
            <p className="text-xs text-[#E8DEC8]/75">
              {isGuru
                ? 'Your screen share or uploaded PDF, Image, or Video appears here in the center stage.'
                : 'Waiting for Guruji to present Gyaan Patra screen or document.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
