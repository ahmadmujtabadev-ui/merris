'use client';

import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '@/lib/store';
import { t } from '@/lib/i18n';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

const ACCEPTED_EXTENSIONS = '.pdf,.xlsx,.docx,.csv,.pptx';

interface FileUploadProps {
  engagementId: string;
  onUploadComplete?: () => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}

export function FileUpload({ engagementId, onUploadComplete }: FileUploadProps) {
  const { locale } = useAuthStore();
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const newFiles = Array.from(fileList)
        .filter((f) => ACCEPTED_TYPES.includes(f.type) || f.name.match(/\.(pdf|xlsx|docx|csv|pptx)$/i))
        .map((file): UploadingFile => ({ file, progress: 0, status: 'uploading' }));

      if (newFiles.length === 0) return;

      setFiles((prev) => [...prev, ...newFiles]);

      // Simulate upload progress for each file
      newFiles.forEach((uf, idx) => {
        const interval = setInterval(() => {
          setFiles((prev) =>
            prev.map((f) => {
              if (f.file !== uf.file) return f;
              const nextProgress = Math.min(f.progress + 15 + Math.random() * 20, 100);
              if (nextProgress >= 100) {
                clearInterval(interval);
                onUploadComplete?.();
                return { ...f, progress: 100, status: 'complete' as const };
              }
              return { ...f, progress: nextProgress };
            }),
          );
        }, 300 + idx * 100);
      });
    },
    [engagementId, onUploadComplete],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          dragOver
            ? 'border-emerald-500 bg-emerald-500/5'
            : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-900/50',
        )}
      >
        <div className="mb-2 text-3xl">📄</div>
        <p className="text-sm text-zinc-300">{t(locale, 'documents.dragDrop')}</p>
        <p className="mt-1 text-xs text-zinc-500">{t(locale, 'documents.accepted')}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={(e) => e.stopPropagation()}>
          {t(locale, 'documents.upload')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Upload progress list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((uf, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-md bg-zinc-900 p-3">
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm text-zinc-200">{uf.file.name}</p>
                <p className="text-xs text-zinc-500">{formatSize(uf.file.size)}</p>
              </div>
              <div className="w-24">
                <Progress
                  value={uf.progress}
                  indicatorClassName={uf.status === 'error' ? 'bg-red-500' : undefined}
                />
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  uf.status === 'complete' && 'text-emerald-400',
                  uf.status === 'uploading' && 'text-zinc-400',
                  uf.status === 'error' && 'text-red-400',
                )}
              >
                {uf.status === 'complete' ? 'Done' : uf.status === 'error' ? 'Error' : `${Math.round(uf.progress)}%`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
