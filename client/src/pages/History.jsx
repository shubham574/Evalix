import React, { useState } from 'react';
import {
  FiTrash2, FiBriefcase, FiList, FiVideo,
  FiMessageSquare, FiFileText, FiCheckCircle, FiMic, FiClock,
} from 'react-icons/fi';
import { useApiQuery, useApiMutation } from '../hooks/useApi';
import { API } from '../api/endpoints';
import SEOHead from '../components/common/SEOHead';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import { formatDate } from '../utils/helpers';
import EvalixOrb from '../components/ui/EvalixOrb';

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

  const getColorForType = (type) => {
    switch (type) {
      case 'live':
        return 'bg-[#FF6B35]/15 text-[#FF6B35] border-[#FF6B35]/30';
      case 'mock':
        return 'bg-[#C7F36B]/35 text-[#151515] dark:text-[#C7F36B] border-[#151515]/20';
      case 'assessment':
        return 'bg-[#8174FF]/15 text-[#8174FF] border-[#8174FF]/30';
      case 'mcq':
        return 'bg-[#FF6B35]/15 text-[#FF6B35] border-[#FF6B35]/30';
      case 'interview':
        return 'bg-[#8174FF]/15 text-[#8174FF] border-[#8174FF]/30';
      case 'analysis':
        return 'bg-[#C7F36B]/35 text-[#151515] dark:text-[#C7F36B] border-[#151515]/20';
      default:
        return 'bg-bg-canvas text-text-primary border-border-subtle';
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

  const historyItems = response?.data || [];

  return (
    <div className="space-y-6 pb-10">
      <SEOHead title="Session History — Evalix" />

      {/* Header & Filter Pills */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <h1 className="heading-page text-text-primary">Session History</h1>
          <p className="text-sm sm:text-base text-text-secondary mt-1">
            Review past <strong className="text-text-primary font-semibold">voice interviews</strong>, <strong className="text-text-primary font-semibold">mock rounds</strong>, <strong className="text-text-primary font-semibold">timed assessments</strong>, and <strong className="text-text-primary font-semibold">JD analyses</strong>.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`px-3.5 py-1.5 rounded-[10px] font-mono text-xs font-semibold transition-all border cursor-pointer ${
                filter === id
                  ? 'bg-[#151515] text-[#F8F5EF] border-[#151515] dark:bg-[#FF6B35] dark:border-[#FF6B35]'
                  : 'bg-bg-surface text-text-secondary border-border-subtle hover:border-text-primary hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-0 overflow-hidden border border-border-subtle min-h-[480px]">
        {isLoading ? (
          <div className="h-80 flex justify-center items-center">
            <Loader />
          </div>
        ) : historyItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-canvas">
                  <th className="py-3.5 px-6 font-mono font-bold text-text-muted text-xs uppercase tracking-wider w-44">
                    Mode
                  </th>
                  <th className="py-3.5 px-6 font-mono font-bold text-text-muted text-xs uppercase tracking-wider">
                    Target Role / Track
                  </th>
                  <th className="py-3.5 px-6 font-mono font-bold text-text-muted text-xs uppercase tracking-wider w-40">
                    Date
                  </th>
                  <th className="py-3.5 px-6 font-mono font-bold text-text-muted text-xs uppercase tracking-wider w-36">
                    Outcome
                  </th>
                  <th className="py-3.5 px-6 font-mono font-bold text-text-muted text-xs uppercase tracking-wider w-20 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {historyItems.map((item, idx) => (
                  <tr
                    key={item._id || idx}
                    className="hover:bg-bg-canvas/70 transition-colors group"
                  >
                    <td className="py-4 px-6">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-[6px] text-[11px] font-mono font-bold uppercase tracking-wider border ${getColorForType(
                          item.historyType
                        )}`}
                      >
                        {getLabelForType(item.historyType)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-display font-bold text-sm sm:text-base text-text-primary">
                        {item.jobRole || 'General Track'}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-xs font-mono text-text-secondary">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="py-4 px-6">
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
                      {item.historyType === 'mcq' && (
                        <Badge variant="purple">{item.count} Prompts</Badge>
                      )}
                      {item.historyType === 'analysis' && (
                        <Badge variant="default">{item.experienceLevel}</Badge>
                      )}
                      {item.historyType === 'interview' && (
                        <Badge variant="default">Playbook</Badge>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.historyType, item._id)}
                        className="p-2 text-text-muted hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-[8px] transition-colors cursor-pointer"
                        title="Delete record"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-20 flex flex-col justify-center items-center text-center px-4">
            <EvalixOrb size="md" state="idle" />
            <p className="font-display font-bold text-base text-text-primary mt-4">
              No records match the selected filter
            </p>
            <p className="text-xs text-text-secondary mt-1 max-w-xs">
              Complete a voice interview, mock session, or JD analysis to populate your training archive.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default History;
