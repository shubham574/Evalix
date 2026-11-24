import React, { useState, useRef } from 'react';
import {
  FiUploadCloud, FiFileText, FiCheck, FiAlertTriangle,
  FiX, FiTrendingUp, FiEdit3,
} from 'react-icons/fi';
import { useApiMutation } from '../hooks/useApi';
import { API } from '../api/endpoints';
import SEOHead from '../components/common/SEOHead';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { showError } from '../components/ui/Toast';
import EvalixOrb from '../components/ui/EvalixOrb';
import { PageHeader, Eyebrow, Reveal, Aura, ScoreRing, NumberTicker } from '@/components/studio';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/shadcn/tooltip';

const ResumeAnalyzer = () => {
  const [jobDescription, setJobDescription] = useState('');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const fileInputRef = useRef(null);

  // Analyze mutation
  const analyzeMutation = useApiMutation(API.RESUME.ANALYZE, 'post', {
    successMessage: 'Resume ATS scan complete!',
    onSuccess: (data) => {
      setAnalysisResult(data.data);
    },
  });

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    if (selectedFile.type !== 'application/pdf') {
      showError('Please upload a PDF file');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      showError('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyze = (e) => {
    e.preventDefault();

    if (!file) {
      return showError('Please upload your resume');
    }

    if (!jobDescription.trim()) {
      return showError('Please paste the job description');
    }

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('jobDescription', jobDescription);

    analyzeMutation.mutate(formData);
  };

  const score = Math.round(analysisResult?.matchScore || 0);
  const ringColor = score >= 80 ? '#5DAA3A' : score >= 60 ? '#1D9E4B' : '#D92D20';

  return (
    <div className="pb-12">
      <SEOHead title="Resume & ATS Match Scanner — Evalix Prep Lab" />

      <PageHeader
        eyebrow="Prep lab · ATS scanner"
        title="Match your resume to the"
        accent="role"
        description={
          <>
            Upload your <strong className="text-text-primary font-medium">PDF resume (up to 5MB)</strong> and compare it against a
            target job description to find <strong className="text-text-primary font-medium">missing keywords</strong> and{' '}
            <strong className="text-text-primary font-medium">bullet rewrites</strong>.
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Upload & JD Input */}
        <div className="lg:col-span-5 xl:col-span-4 min-w-0">
          <Reveal>
            <Card padding="p-6 sm:p-8" className="rounded-[28px]">
              <form onSubmit={handleAnalyze} className="space-y-6">
                {/* File Upload Zone */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Eyebrow index="01">Upload Resume</Eyebrow>
                    <span className="text-[11px] font-mono text-text-muted">PDF · Max 5MB</span>
                  </div>

                  {!file ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      className={`group border-2 border-dashed rounded-[24px] px-6 py-10 text-center transition-all duration-300 cursor-pointer flex flex-col items-center justify-center ${
                        isDragging
                          ? 'border-[#1D9E4B] bg-peach scale-[1.01]'
                          : 'border-border-subtle bg-bg-elevated hover:border-[#1D9E4B]/50 hover:bg-surface-hover'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="application/pdf"
                        className="hidden"
                      />
                      <span
                        className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-transform duration-500 group-hover:-translate-y-1 ${
                          isDragging ? 'bg-bg-surface text-[#1D9E4B]' : 'bg-peach text-[#167A3A] dark:text-[#6FD394]'
                        }`}
                      >
                        <FiUploadCloud className="w-6 h-6" />
                      </span>
                      <p className="font-display font-normal tracking-[-0.02em] text-[15px] text-text-primary mb-1">
                        Drop your PDF resume or click to browse
                      </p>
                      <p className="text-xs text-text-muted">PDF format • Up to 5MB</p>
                    </div>
                  ) : (
                    <div className="rounded-[20px] p-3.5 pl-4 bg-mint flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-full bg-bg-surface/80 text-[#2F6B12] dark:text-[#A8E07E] flex items-center justify-center shrink-0">
                          <FiFileText className="w-[18px] h-[18px]" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
                          <p className="text-xs text-text-secondary">
                            {(file.size / 1024 / 1024).toFixed(2)} MB • Ready
                          </p>
                        </div>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={removeFile}
                            aria-label="Remove file"
                            className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary bg-bg-surface/70 hover:text-danger hover:bg-danger-bg transition-colors cursor-pointer shrink-0"
                          >
                            <FiX />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Remove file</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Eyebrow index="02">Target job description</Eyebrow>
                  <Input
                    id="jd"
                    aria-label="Target Job Description"
                    placeholder="Paste the full job description to compare your resume against..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    textarea
                    rows={10}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  loading={analyzeMutation.isPending}
                  disabled={!file || !jobDescription}
                >
                  Scan resume match
                </Button>
              </form>
            </Card>
          </Reveal>
        </div>

        {/* Right Column: ATS Match Report */}
        <div className="lg:col-span-7 xl:col-span-8 min-w-0">
          {analyzeMutation.isPending ? (
            <div className="relative overflow-hidden rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-10 sm:p-14 flex flex-col items-center justify-center min-h-[520px] text-center">
              <Aura intensity={0.55} />
              <div className="relative flex flex-col items-center">
                <EvalixOrb size="lg" state="evaluating" />
                <Eyebrow dot className="mt-7">Scanning</Eyebrow>
                <h3 className="font-display font-normal tracking-[-0.035em] text-2xl sm:text-3xl text-text-primary mt-3 text-balance">
                  Comparing resume against <span className="serif italic text-[#1D9E4B]">job description</span>…
                </h3>
                <p className="text-sm sm:text-[15px] text-text-secondary mt-3 max-w-md leading-relaxed">
                  Checking keyword overlap, technical skills, and experience alignment.
                </p>
              </div>
            </div>
          ) : analysisResult ? (
            <div className="space-y-6 animate-fade-in">
              {/* ATS Match Score */}
              <div className="relative overflow-hidden rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-6 sm:p-8">
                <Aura intensity={0.3} />
                <div className="relative grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                  <div className="md:col-span-5 flex flex-col items-center text-center">
                    <span className="eyebrow mb-4">ATS Match Score</span>
                    <ScoreRing value={score} size={176} stroke={10} color={ringColor}>
                      <span className="font-display font-normal tracking-[-0.05em] text-5xl sm:text-6xl leading-none text-text-primary">
                        <NumberTicker value={score} />
                        <span className="text-2xl text-text-muted align-top">%</span>
                      </span>
                    </ScoreRing>
                    <span
                      className={`mt-5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium ${
                        score >= 80
                          ? 'bg-mint text-[#2F6B12] dark:text-[#A8E07E]'
                          : 'bg-peach text-[#167A3A] dark:text-[#6FD394]'
                      }`}
                    >
                      {score >= 80 ? <FiCheck /> : <FiAlertTriangle />}
                      {score >= 80 ? 'Strong Match' : 'Needs Keyword Updates'}
                    </span>
                  </div>

                  <div className="md:col-span-7 space-y-3 md:border-l md:border-border-subtle md:pl-8">
                    <Eyebrow index="01">Overview</Eyebrow>
                    <h2 className="font-display font-normal tracking-[-0.035em] text-2xl sm:text-3xl text-text-primary">
                      Alignment <span className="serif italic text-[#1D9E4B]">summary</span>
                    </h2>
                    <p className="text-[15px] text-text-secondary leading-relaxed">
                      {analysisResult.summary}
                    </p>
                  </div>
                </div>
              </div>

              {/* Matched vs Missing Skills */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card padding="p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <span className="eyebrow">Covered</span>
                      <h3 className="font-display font-normal tracking-[-0.03em] text-lg text-text-primary mt-2">
                        Matched skills
                      </h3>
                    </div>
                    <span className="font-display font-normal tracking-[-0.05em] text-4xl leading-none text-[#2F6B12] dark:text-[#A8E07E]">
                      {analysisResult.matchedSkills?.length || 0}
                    </span>
                  </div>

                  {analysisResult.matchedSkills?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.matchedSkills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-mint text-[#2F6B12] dark:text-[#A8E07E] text-[13px] font-medium"
                        >
                          <FiCheck className="w-3.5 h-3.5" />
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">
                      No direct skill matches detected from the job description.
                    </p>
                  )}
                </Card>

                <Card padding="p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <span className="eyebrow">Gaps</span>
                      <h3 className="font-display font-normal tracking-[-0.03em] text-lg text-text-primary mt-2">
                        Missing keywords
                      </h3>
                    </div>
                    <span className="font-display font-normal tracking-[-0.05em] text-4xl leading-none text-[#167A3A] dark:text-[#6FD394]">
                      {analysisResult.missingSkills?.length || 0}
                    </span>
                  </div>

                  {analysisResult.missingSkills?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.missingSkills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-peach text-[#B23E12] dark:text-[#6FD394] text-[13px] font-medium"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E4B]" />
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">
                      Your resume covers all primary keywords in this job description.
                    </p>
                  )}
                </Card>
              </div>

              {/* Actionable Resume Improvements */}
              <Card padding="p-6 sm:p-8">
                <div className="flex items-center gap-3.5 mb-6">
                  <span className="w-10 h-10 rounded-full bg-lilac text-[#1D6FB8] dark:text-[#8EC1FF] flex items-center justify-center shrink-0">
                    <FiEdit3 className="w-[18px] h-[18px]" />
                  </span>
                  <div>
                    <h3 className="font-display font-normal tracking-[-0.03em] text-xl text-text-primary">
                      Recommended resume edits
                    </h3>
                    <p className="text-sm text-text-secondary mt-0.5">
                      Specific bullet and keyword adjustments to improve alignment with this role.
                    </p>
                  </div>
                </div>

                <ol className="grid grid-cols-1 gap-3">
                  {analysisResult.recommendations?.map((rec, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-4 text-[15px] text-text-primary bg-bg-elevated p-4 sm:p-5 rounded-[18px]"
                    >
                      <span className="w-7 h-7 rounded-full bg-bg-surface border border-border-subtle font-mono text-[11px] text-[#1D9E4B] flex items-center justify-center shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="leading-relaxed pt-0.5">{rec}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm p-10 sm:p-14 min-h-[520px] flex flex-col justify-center items-center text-center">
              <Aura intensity={0.45} />
              <div className="relative flex flex-col items-center">
                <EvalixOrb size="lg" state="idle" />
                <Eyebrow dot className="mt-7">Awaiting upload</Eyebrow>
                <h3 className="font-display font-normal tracking-[-0.035em] text-2xl sm:text-3xl text-text-primary mt-3 text-balance max-w-lg">
                  Compare your resume against <span className="serif italic text-[#1D9E4B]">any</span> job posting
                </h3>
                <p className="text-sm sm:text-[15px] text-text-secondary mt-3 max-w-md leading-relaxed">
                  Upload your <strong className="text-text-primary font-medium">PDF resume</strong> and paste the{' '}
                  <strong className="text-text-primary font-medium">target job description</strong> to see matched skills, missing
                  keywords, and specific bullet improvements.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-mint text-[#2F6B12] dark:text-[#A8E07E] text-xs font-medium">
                    <FiCheck /> Matched skills
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-peach text-[#167A3A] dark:text-[#6FD394] text-xs font-medium">
                    <FiAlertTriangle /> Missing keywords
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-lilac text-[#1D6FB8] dark:text-[#8EC1FF] text-xs font-medium">
                    <FiTrendingUp /> Bullet rewrites
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResumeAnalyzer;
