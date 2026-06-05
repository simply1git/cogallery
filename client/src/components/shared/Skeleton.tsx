

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`rounded-md ${className}`}
      style={{
        background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.8s ease-in-out infinite',
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-[#0a0a0a]">
      <Skeleton className="h-28 w-full rounded-none" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-5 w-3/4 rounded-lg" />
        <Skeleton className="h-3.5 w-1/2 rounded-lg" />
        <div className="flex gap-3 mt-4 pt-3 border-t border-white/[0.04]">
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-4 w-20 ml-auto rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] mb-8">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-violet-600/3 to-transparent" />
      <div className="relative p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
              <Skeleton className="h-8 w-48 sm:w-64 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-72 sm:w-96 rounded-md ml-[52px]" />
            <div className="flex gap-4 mt-4">
              <Skeleton className="h-5 w-24 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="w-24 h-10 rounded-xl hidden sm:block" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhotoGridSkeleton() {
  const heights = [200, 260, 180, 300, 220, 240, 190, 270, 210, 250, 180, 230];
  return (
    <div className="masonry-grid">
      {heights.map((h, i) => (
        <div
          key={i}
          className="masonry-item rounded-xl overflow-hidden"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <Skeleton className="w-full rounded-xl" style={{ height: `${h}px` }} />
        </div>
      ))}
    </div>
  );
}
