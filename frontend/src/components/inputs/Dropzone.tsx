import { useDropzone } from "react-dropzone";
import { UploadCloud, File, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  accept: Record<string, string[]>;
  label: string;
  sublabel: string;
  icon?: React.ReactNode;
}

export function Dropzone({ onFileSelect, selectedFile, accept, label, sublabel, icon }: DropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    }
  });

  if (selectedFile) {
    return (
      <div className="relative overflow-hidden group bg-primary/5 border border-primary/30 rounded-xl p-6 flex flex-col items-center justify-center transition-all">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <File className="w-10 h-10 text-primary mb-3" />
        <p className="text-sm font-medium text-foreground text-center truncate max-w-[200px]">
          {selectedFile.name}
        </p>
        <p className="text-xs text-primary/80 mt-1">Ready to process</p>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFileSelect(null);
          }}
          className="absolute top-2 right-2 p-1.5 bg-background/50 hover:bg-destructive/20 text-muted-foreground hover:text-destructive rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200",
        isDragActive 
          ? "border-primary bg-primary/5 shadow-glow scale-[1.02]" 
          : "border-border bg-surface hover:border-primary/50 hover:bg-surface-hover"
      )}
    >
      <input {...getInputProps()} />
      <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center mb-4 shadow-sm">
        {icon || <UploadCloud className="w-6 h-6 text-muted-foreground" />}
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{label}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    </div>
  );
}
