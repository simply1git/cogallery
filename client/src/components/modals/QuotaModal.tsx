import { useState, useEffect } from 'react'
import { X, HardDrive } from 'lucide-react'

interface QuotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bytes: number) => void;
  currentBytes: number;
  userName: string;
}

export function QuotaModal({ isOpen, onClose, onSave, currentBytes, userName }: QuotaModalProps) {
  const [unit, setUnit] = useState<'MB' | 'GB'>('GB');
  const [value, setValue] = useState<string>('5');

  useEffect(() => {
    if (isOpen) {
      if (currentBytes >= 1024 * 1024 * 1024) {
        setUnit('GB');
        setValue((currentBytes / (1024 * 1024 * 1024)).toFixed(2).replace(/\.00$/, ''));
      } else {
        setUnit('MB');
        setValue((currentBytes / (1024 * 1024)).toFixed(2).replace(/\.00$/, ''));
      }
    }
  }, [isOpen, currentBytes]);

  if (!isOpen) return null;

  const handleSave = () => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    
    const multiplier = unit === 'GB' ? 1024 * 1024 * 1024 : 1024 * 1024;
    const bytes = Math.round(num * multiplier);
    onSave(bytes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <HardDrive className="text-blue-400" size={20} />
            <h2 className="text-lg font-semibold text-white">Adjust Storage Quota</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">
              User
            </label>
            <div className="text-white font-medium bg-black/50 p-3 rounded-xl border border-white/5">
              {userName}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Storage Limit
            </label>
            <div className="flex gap-2">
              <input 
                type="number" 
                value={value}
                onChange={(e) => setValue(e.target.value)}
                step="0.1"
                min="0.1"
                className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="e.g. 5"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as 'MB' | 'GB')}
                className="bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
              >
                <option value="MB">MB</option>
                <option value="GB">GB</option>
              </select>
            </div>
            <p className="text-xs text-white/40 mt-2">
              The default recommended quota is 5 GB.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-black/30 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!value || parseFloat(value) <= 0}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Quota
          </button>
        </div>
      </div>
    </div>
  )
}
