import React from 'react';
import { Skeleton } from '@/components/shadcn/skeleton';

/** Mirrors the Dashboard layout: greeting hero + readiness dial, KPI tiles, analytics, activity list. */
const Bone = ({ className = '', ...props }) => (
  <Skeleton className={`bg-bg-elevated rounded-full ${className}`} {...props} />
);

const DashboardSkeleton = () => {
  return (
    <div className="space-y-6 sm:space-y-8 w-full" aria-busy="true" aria-label="Loading dashboard">
      {/* ─── Hero + readiness ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 rounded-[32px] bg-bg-surface border border-border-subtle shadow-sm p-6 sm:p-10 space-y-7">
          <Bone className="h-3 w-44" />
          <div className="space-y-4">
            <Skeleton className="h-12 sm:h-16 w-4/5 rounded-[18px] bg-bg-elevated" />
            <Bone className="h-6 w-64 max-w-full" />
            <Bone className="h-4 w-full max-w-lg" />
          </div>
          <div className="flex flex-wrap gap-2">
            {[96, 112, 120, 104, 110].map((w) => (
              <Bone key={w} className="h-9" style={{ width: w }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Bone className="h-13 w-56" />
            <Bone className="h-13 w-44" />
          </div>
        </div>
        <div className="lg:col-span-4 rounded-[32px] bg-peach border border-[#1D9E4B]/15 p-6 sm:p-8 flex flex-col items-center justify-between gap-6 min-h-[360px]">
          <div className="w-full flex justify-between">
            <Skeleton className="h-3 w-28 rounded-full bg-bg-surface/70" />
            <Skeleton className="h-6 w-20 rounded-full bg-bg-surface/70" />
          </div>
          <Skeleton className="size-[184px] rounded-full bg-bg-surface/70" />
          <Skeleton className="h-4 w-40 rounded-full bg-bg-surface/70" />
        </div>
      </div>

      {/* ─── KPI tiles ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-6 sm:p-7 space-y-6">
            <div className="flex justify-between">
              <div className="space-y-3">
                <Skeleton className="size-10 rounded-full bg-bg-elevated" />
                <Bone className="h-3 w-32" />
              </div>
              <Bone className="h-6 w-16" />
            </div>
            <Skeleton className="h-14 w-24 rounded-[16px] bg-bg-elevated" />
            <Bone className="h-1.5 w-full" />
          </div>
        ))}
      </div>

      {/* ─── Analytics ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-5 sm:p-7 space-y-5">
          <div className="flex justify-between gap-4">
            <div className="space-y-3">
              <Bone className="h-3 w-28" />
              <Skeleton className="h-8 w-64 max-w-full rounded-[12px] bg-bg-elevated" />
            </div>
            <Bone className="h-10 w-32" />
          </div>
          <Bone className="h-10 w-72 max-w-full" />
          <Skeleton className="h-64 sm:h-80 w-full rounded-[22px] bg-bg-elevated/70" />
        </div>
        <div className="lg:col-span-4 rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-5 sm:p-7 space-y-6">
          <div className="space-y-3">
            <Bone className="h-3 w-24" />
            <Skeleton className="h-6 w-48 rounded-[10px] bg-bg-elevated" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2.5">
              <div className="flex justify-between">
                <Bone className="h-4 w-32" />
                <Bone className="h-4 w-12" />
              </div>
              <Bone className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* ─── Activity list ─── */}
      <div className="rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm overflow-hidden">
        <div className="p-5 sm:p-7 border-b border-border-subtle flex flex-wrap justify-between gap-4">
          <Bone className="h-9 w-72 max-w-full" />
          <Bone className="h-10 w-56 max-w-full" />
        </div>
        <div className="divide-y divide-border-subtle">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="px-5 sm:px-7 py-4 flex items-center gap-5">
              <Bone className="h-6 w-14 shrink-0" />
              <Bone className="h-4 flex-1" />
              <Bone className="hidden sm:block h-4 w-36" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
