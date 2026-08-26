import React from 'react';

interface ContentSkeletonProps { variant?: 'dashboard' | 'table' | 'form'; label?: string; }
const Bone = ({ className }: { className: string }) => <div className={`skeleton-bone ${className}`} />;

/** Layout-faithful placeholders that reserve final content space and avoid layout shifts. */
const ContentSkeleton: React.FC<ContentSkeletonProps> = ({ variant = 'table', label = 'Préparation du contenu…' }) => (
  <div className="content-skeleton" role="status" aria-live="polite" aria-label={label}>
    <div className="mb-8 space-y-3"><Bone className="h-3 w-24" /><Bone className="h-8 w-64 max-w-[75%]" /><Bone className="h-4 w-[430px] max-w-full" /></div>
    {variant === 'dashboard' && <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map(item => <div className="skeleton-card" key={item}><Bone className="mb-5 h-8 w-8 rounded-lg" /><Bone className="mb-3 h-3 w-20" /><Bone className="h-7 w-16" /></div>)}</div>}
    {variant === 'form' ? <div className="skeleton-panel grid gap-5 sm:grid-cols-2">{[0, 1, 2, 3, 4, 5].map(item => <div key={item}><Bone className="mb-2 h-3 w-24" /><Bone className="h-11 w-full rounded-xl" /></div>)}</div> : <div className="skeleton-panel"><div className="mb-6 flex items-center justify-between gap-4"><Bone className="h-5 w-40" /><Bone className="h-10 w-28 rounded-xl" /></div>{[0, 1, 2, 3, 4].map(item => <div className="flex items-center gap-4 border-t border-slate-100 py-4" key={item}><Bone className="h-9 w-9 rounded-full" /><div className="flex-1 space-y-2"><Bone className="h-4 w-2/5" /><Bone className="h-3 w-3/5" /></div><Bone className="h-6 w-16 rounded-full" /></div>)}</div>}
  </div>
);
export default ContentSkeleton;
