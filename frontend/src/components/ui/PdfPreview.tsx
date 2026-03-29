import { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

// Point to the worker file served from /public — works in all iframe contexts
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfPreviewProps {
  blob: Blob | null;
  className?: string;
}

export function PdfPreview({ blob, className = "" }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setCurrentPage(1);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message || "Failed to load PDF preview.");
  }, []);

  if (!blob) return null;

  return (
    <div className={`flex flex-col h-full bg-[#525659] ${className}`}>
      <Document
        file={blob}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-white/60" />
              <p className="text-sm text-white/50">Loading preview…</p>
            </div>
          </div>
        }
        error={
          <div className="flex-1 flex items-center justify-center h-full p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-sm text-white/70 max-w-xs">
                {error || "Could not render PDF preview. Try downloading the file instead."}
              </p>
            </div>
          </div>
        }
        className="flex-1 overflow-y-auto flex flex-col items-center py-4 gap-3 custom-scrollbar"
      >
        {numPages > 0 && Array.from({ length: numPages }, (_, i) => (
          <Page
            key={`page_${i + 1}`}
            pageNumber={i + 1}
            width={680}
            renderTextLayer={true}
            renderAnnotationLayer={false}
            className="shadow-2xl"
          />
        ))}
      </Document>

      {/* Page indicator */}
      {numPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-center gap-3 py-2 bg-[#3a3d40] border-t border-white/10">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-white/60 font-mono">
            {numPages} page{numPages !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="p-1 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
