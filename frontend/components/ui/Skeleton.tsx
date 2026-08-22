import type { CSSProperties } from 'react';

export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`animate-pulse rounded-xl bg-white/10 ${className}`} style={style} />;
}

export function CardSkeleton() {
  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function ChartSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6 ${height} flex items-center justify-center`}>
      <div className="text-center space-y-2">
        <Skeleton className="h-4 w-32 mx-auto" />
        <div className="flex items-end gap-1 justify-center mt-4">
          {[40, 60, 45, 80, 55, 70, 50, 90, 65, 75].map((h, i) => (
            <Skeleton key={i} className="w-6" style={{ height: `${h}px` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
