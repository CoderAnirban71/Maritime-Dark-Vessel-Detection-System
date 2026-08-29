import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastProps {
  id: string;
  type?: 'success' | 'warning' | 'info';
  title: string;
  message?: string;
  onDismiss: (id: string) => void;
}

export function Toast({ id, type = 'success', title, message, onDismiss }: ToastProps) {
  const iconMap = {
    success: <CheckCircle2 className="w-3.5 h-3.5 text-[#5EE6C0]" />,
    warning: <AlertTriangle className="w-3.5 h-3.5 text-[#E8A84E]" />,
    info: <Info className="w-3.5 h-3.5 text-[#5EE6C0]" />,
  };

  return (
    <div className="bg-[#111716] border border-[#38B99A]/50 rounded-xs p-3 shadow-2xl flex items-start gap-2.5 max-w-sm font-mono text-xs select-none">
      <div className="mt-0.5 flex-shrink-0">{iconMap[type]}</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[#E8EFEC] text-xs">{title}</div>
        {message && <div className="text-[10px] text-[#A5B1AC] font-sans mt-0.5">{message}</div>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="text-[#68746F] hover:text-[#E8EFEC] cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
