import React, { useState } from 'react';
import {
  FiTrash2, FiBriefcase, FiList, FiVideo,
  FiMessageSquare, FiFileText, FiCheckCircle, FiMic,
} from 'react-icons/fi';
import { useApiQuery, useApiMutation } from '../hooks/useApi';
import { API } from '../api/endpoints';
import SEOHead from '../components/common/SEOHead';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import { formatDate } from '../utils/helpers';
import EvalixOrb from '../components/ui/EvalixOrb';
import { PageHeader, Reveal } from '@/components/studio';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/shadcn/tooltip';
import { cn } from '@/lib/utils';

const FILTERS = [
  { id: 'all', label: 'All Activity' },
  { id: 'live', label: 'Live Voice' },
  { id: 'mock', label: 'Structured Mock' },
  { id: 'assessment', label: 'Assessments' },
  { id: 'mcq', label: 'MCQ Drills' },
  { id: 'interview', label: 'Q&A Playbooks' },
  { id: 'analysis', label: 'JD Analyses' },
];

const History = () => {
  const [filter, setFilter] = useState('all');

  const { data: response, isLoading, refetch } = useApiQuery(
    ['history', filter],
    `${API.HISTORY.LIST}?type=${filter}&limit=50`
  );

  const deleteMutation = useApiMutation('', 'delete', {
    successMessage: 'Record deleted',
    onSuccess: () => refetch(),
  });

  const handleDelete = (type, id) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      deleteMutation.mutate(null, {
        url: API.HISTORY.DELETE(type, id),
      });
    }
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'analysis':
        return <FiBriefcase />;
      case 'mcq':
        return <FiList />;
      case 'assessment':
        return <FiCheckCircle />;
      case 'interview':
        return <FiMessageSquare />;
      case 'mock':
        return <FiVideo />;
      case 'live':
        return <FiMic />;
      default:
        return <FiFileText />;
    }
  };

  // Pastel tint + matching ink for each record type (adapts in dark mode via tint tokens)
  const getColorForType = (type) => {
    switch (type) {
      case 'live':
        return 'bg-peach text-[#167A3A] dark:text-[#6FD394]';
      case 'mock':
        return 'bg-mint text-[#2F6B12] dark:text-[#A8E07E]';
      case 'assessment':
        return 'bg-lilac text-[#1D6FB8] dark:text-[#8EC1FF]';
      case 'mcq':
        return 'bg-butter text-[#9A6B00] dark:text-[#F5D36B]';
      case 'interview':
        return 'bg-sky text-[#1D5FAF] dark:text-[#8EC1FF]';
      case 'analysis':
        return 'bg-tint-sand text-text-secondary';
      default:
        return 'bg-bg-elevated text-text-secondary';
    }
  };

  const getLabelForType = (type) => {
    switch (type) {
      case 'analysis':
        return 'JD Analysis';
      case 'mcq':
        return 'MCQ Set';
      case 'assessment':
        return 'Timed Assessment';
      case 'interview':
        return 'Q&A Bank';
      case 'mock':
        return 'Mock Interview';
      case 'live':
        return 'Voice Interview';
      default:
        return type;
    }
  };

  const renderOutcome = (item) => (
    <>
      {item.historyType === 'assessment' && (
        <Badge variant={item.score >= 70 ? 'success' : 'warning'}>
          {Math.round(item.score || 0)}% Score
        </Badge>
      )}
      {item.historyType === 'mock' && item.status === 'completed' && (
        <Badge variant="success">
          {Math.round(item.overallFeedback?.averageScore || 0)}% Score
        </Badge>
      )}
      {item.historyType === 'mock' && item.status !== 'completed' && (
        <Badge variant="warning">In Progress</Badge>
      )}
      {item.historyType === 'live' && item.status === 'completed' && (
        <Badge variant="success">
          {Math.round(item.overallFeedback?.averageScore || 0)}% Score
        </Badge>
      )}
      {item.historyType === 'live' && item.status !== 'completed' && (
        <Badge variant="primary">{item.difficulty || 'Live Voice'}</Badge>
      )}
      {item.historyType === 'mcq' && <Badge variant="secondary">{item.count} Prompts</Badge>}
      {item.historyType === 'analysis' && <Badge variant="default">{item.experienceLevel}</Badge>}
      {item.historyType === 'interview' && <Badge variant="default">Playbook</Badge>}
    </>
  );

  const historyItems = response?.data || [];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6 pb-12">
        <SEOHead title="Session History — Evalix" />

        <PageHeader
          eyebrow="Training archive"
          title="Session"
          accent="history"
          className="pb-4"
          description={
            <>
              Review past <strong className="text-text-primary font-medium">voice interviews</strong>,{' '}
              <strong className="text-text-primary font-medium">mock rounds</strong>,{' '}
              <strong className="text-text-primary font-medium">timed assessments</strong>, and{' '}
              <strong className="text-text-primary font-medium">JD analyses</strong>.
            </>
          }
        />

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter history">
          {FILTERS.map(({ id, label }) => {
            const active = filter === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(id)}
                className={cn(
                  'h-9 px-4 rounded-full text-[13px] font-medium tracking-[-0.01em] border transition-colors duration-300 cursor-pointer',
                  active
                    ? 'bg-peach text-[#167A3A] border-[#1D9E4B]/25 dark:text-[#6FD394]'
                    : 'bg-bg-surface text-text-secondary border-border-subtle hover:text-text-primary hover:border-text-primary/20'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <Reveal y={16}>
          <div className="rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm overflow-hidden min-h-[420px]">
            {isLoading ? (
              <div className="h-80 flex justify-center items-center">
                <Loader />
              </div>
            ) : historyItems.length > 0 ? (
              <>
                {/* Column labels (desktop) */}
                <div className="hidden md:grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_140px_150px_48px] gap-5 px-7 py-4 border-b border-border-subtle">
                  <span className="eyebrow">Mode</span>
                  <span className="eyebrow">Target role / track</span>
                  <span className="eyebrow">Date</span>
                  <span className="eyebrow">Outcome</span>
                  <span className="eyebrow text-right sr-only">Action</span>
                </div>

                <ul className="divide-y divide-border-subtle">
                  {historyItems.map((item, idx) => (
                    <li
                      key={item._id || idx}
                      className="group grid grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_140px_150px_48px] items-center gap-x-4 md:gap-x-5 gap-y-2 px-5 md:px-7 py-4 hover:bg-surface-hover transition-colors"
                    >
                      {/* Mode */}
                      <div className="flex items-center gap-3 min-w-0 row-span-2 md:row-span-1">
                        <span
                          className={cn(
                            'size-10 shrink-0 rounded-full flex items-center justify-center text-[15px]',
                            getColorForType(item.historyType)
                          )}
                        >
                          {getIconForType(item.historyType)}
                        </span>
                        <span className="hidden md:inline text-[13px] font-medium text-text-secondary truncate">
                          {getLabelForType(item.historyType)}
                        </span>
                      </div>

                      {/* Role + mobile meta */}
                      <div className="min-w-0">
                        <div className="font-display font-normal tracking-[-0.02em] text-[15px] sm:text-base text-text-primary truncate">
                          {item.jobRole || 'General Track'}
                        </div>
                        <div className="md:hidden text-[12px] text-text-muted mt-0.5 truncate">
                          {getLabelForType(item.historyType)} &middot; {formatDate(item.createdAt)}
                        </div>
                      </div>

                      {/* Date (desktop) */}
                      <div className="hidden md:block text-[13px] text-text-muted">{formatDate(item.createdAt)}</div>

                      {/* Outcome */}
                      <div className="col-start-2 row-start-2 md:col-auto md:row-auto">{renderOutcome(item)}</div>

                      {/* Action */}
                      <div className="col-start-3 row-start-1 row-span-2 md:col-auto md:row-auto md:row-span-1 flex justify-end">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.historyType, item._id)}
                              className="size-9 rounded-full flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger-bg transition-colors cursor-pointer"
                              aria-label="Delete record"
                            >
                              <FiTrash2 size={15} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent sideOffset={6}>Delete record</TooltipContent>
                        </Tooltip>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="relative py-24 flex flex-col justify-center items-center text-center px-5">
                <EvalixOrb size="lg" state="idle" />
                <p className="font-display font-normal tracking-[-0.03em] text-xl text-text-primary mt-6">
                  No records match the selected filter
                </p>
                <p className="text-[13px] text-text-secondary mt-2 max-w-xs leading-relaxed">
                  Complete a voice interview, mock session, or JD analysis to populate your training archive.
                </p>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </TooltipProvider>
  );
};

export default History;
