import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-24 animate-slide-up">
      {/* Floating icon with layered glow */}
      <div className="relative w-24 h-24 mx-auto mb-8">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/10 to-violet-500/5 blur-xl animate-float" />
        <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:border-white/[0.18] hover:shadow-[0_0_40px_rgba(59,130,246,0.08)] transition-all duration-500 group cursor-default">
          <Icon 
            size={36} 
            className="text-[#52525b] group-hover:text-blue-400 transition-colors duration-500" 
            strokeWidth={1.5}
          />
        </div>
      </div>

      <h3 className="text-xl font-bold text-[#f4f4f5] mb-2">{title}</h3>
      <p className="text-[#71717a] mb-8 max-w-sm mx-auto leading-relaxed text-sm">
        {description}
      </p>
      {action && (
        <div className="flex justify-center">
          {action}
        </div>
      )}
    </div>
  );
}
