import React from 'react';

const DashboardSkeleton = () => {
  return (
    <div className="space-y-8 animate-pulse w-full">
      {/* ─── Welcome Banner Skeleton ─── */}
      <div className="bg-bg-surface border border-border-subtle rounded-[24px] p-8 flex flex-col lg:flex-row items-center justify-between gap-8 h-auto lg:h-60 w-full">
        <div className="w-full max-w-xl flex flex-col gap-4">
          <div className="h-5 bg-bg-elevated rounded-[8px] w-40" />
          <div className="h-10 bg-bg-elevated rounded-[10px] w-3/4" />
          <div className="h-5 bg-bg-elevated rounded-[8px] w-full mb-2" />
          <div className="flex flex-wrap gap-3">
            <div className="h-10 bg-bg-elevated rounded-[12px] w-40" />
            <div className="h-10 bg-bg-elevated rounded-[12px] w-36" />
          </div>
        </div>
        <div className="hidden lg:flex w-44 h-40 bg-bg-elevated rounded-[18px] shrink-0" />
      </div>

      {/* ─── 4 Metric Cards Skeleton ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-bg-surface border border-border-subtle rounded-[18px] p-5 flex flex-col justify-between h-28"
          >
            <div className="flex justify-between items-center">
              <div className="h-3 bg-bg-elevated rounded w-24" />
              <div className="w-9 h-9 bg-bg-elevated rounded-[10px]" />
            </div>
            <div className="h-7 bg-bg-elevated rounded w-16" />
          </div>
        ))}
      </div>

      {/* ─── Charts & Recent Sessions Skeleton ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        <div className="lg:col-span-7 bg-bg-surface border border-border-subtle rounded-[20px] p-6 h-[340px] flex flex-col">
          <div className="h-6 bg-bg-elevated rounded w-48 mb-6" />
          <div className="flex-1 bg-bg-elevated/50 rounded-[14px] w-full" />
        </div>
        <div className="lg:col-span-5 bg-bg-surface border border-border-subtle rounded-[20px] p-6 h-[340px] flex flex-col gap-4">
          <div className="h-6 bg-bg-elevated rounded w-36 mb-2" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3.5">
              <div className="w-10 h-10 bg-bg-elevated rounded-[10px] shrink-0" />
              <div className="flex flex-col gap-2 flex-1">
                <div className="h-4 bg-bg-elevated rounded w-full" />
                <div className="h-3 bg-bg-elevated rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
