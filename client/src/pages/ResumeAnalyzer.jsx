import React, { useState, useRef } from 'react';
import {
  FiUploadCloud, FiFileText, FiCheck, FiAlertTriangle,
  FiX, FiAward, FiTarget, FiTrendingUp,
} from 'react-icons/fi';
import { useApiMutation } from '../hooks/useApi';
import { API } from '../api/endpoints';
import SEOHead from '../components/common/SEOHead';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { showError } from '../components/ui/Toast';
import EvalixOrb, { EvalixStarburst } from '../components/ui/EvalixOrb';

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

  return (
    <div className="space-y-6 pb-10">
      <SEOHead title="Resume & ATS Match Scanner — Evalix Prep Lab" />

      {/* Page Header */}
      <div className="border-b border-border-subtle pb-5">
        <h1 className="heading-page text-text-primary">Resume &amp; JD Match Scanner</h1>
        <p className="text-sm sm:text-base text-text-secondary mt-1">
          Upload your <strong className="text-text-primary font-semibold">PDF resume (up to 5MB)</strong> and compare it against a target job description to find <strong className="text-text-primary font-semibold">missing keywords</strong> and <strong className="text-text-primary font-semibold">bullet rewrites</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Upload & JD Input (4 cols) */}
        <div className="lg:col-span-4">
          <Card className="p-6 border border-border-subtle">
            <form onSubmit={handleAnalyze} className="space-y-5">
              {/* File Upload Zone */}
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-wider font-semibold text-text-secondary block">
                  1. Upload Resume (PDF, Max 5MB)
                </label>

                {!file ? (
                  <div
                    className={`border-2 border-dashed rounded-[16px] p-7 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isDragging
                        ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                        : 'border-border-strong bg-bg-canvas hover:border-[#FF6B35]'
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
                    <FiUploadCloud className="w-7 h-7 text-[#FF6B35] mb-2.5" />
                    <p className="text-sm font-display font-bold text-text-primary mb-1">
                      Drop your PDF resume or click to browse
                    </p>
                    <p className="text-xs font-mono text-text-muted">PDF format • Up to 5MB</p>
                  </div>
                ) : (
                  <div className="border border-border-strong rounded-[14px] p-3.5 bg-bg-canvas flex items-center justify-between">
                    <div className="truncate pr-2">
                      <p className="text-sm font-display font-bold text-text-primary truncate">
                        {file.name}
                      </p>
                      <p className="text-xs font-mono text-text-muted">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • Ready
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="p-2 text-text-muted hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-[8px] transition-colors ml-2 cursor-pointer"
                    >
                      <FiX />
                    </button>
                  </div>
                )}
              </div>

              <Input
                id="jd"
                label="2. Target Job Description"
                placeholder="Paste the full job description to compare your resume against..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                textarea
                rows={10}
                required
              />

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={analyzeMutation.isPending}
                disabled={!file || !jobDescription}
              >
                Scan Resume Match
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: ATS Match Report (8 cols) */}
        <div className="lg:col-span-8">
          {analyzeMutation.isPending ? (
            <div className="rounded-[24px] bg-[#151515] text-[#F8F5EF] border border-[#2E2E2E] p-12 flex flex-col items-center justify-center min-h-[500px] text-center">
              <EvalixOrb size="lg" state="evaluating" />
              <h3 className="heading-card text-[#F8F5EF] mt-5">
                Comparing Resume Against Job Description...
              </h3>
              <p className="text-sm text-[#F8F5EF]/65 mt-2 max-w-md">
                Checking keyword overlap, technical skills, and experience alignment.
              </p>
            </div>
          ) : analysisResult ? (
            <div className="space-y-6 animate-fade-in">
              {/* ATS Match Score Banner */}
              <div className="rounded-[24px] bg-[#151515] text-[#F8F5EF] border border-[#2E2E2E] p-6 sm:p-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-4 flex flex-col items-center md:items-start text-center md:text-left border-b md:border-b-0 md:border-r border-[#2E2E2E] pb-6 md:pb-0 md:pr-6">
                    <span className="text-[11px] font-mono uppercase tracking-widest text-[#F8F5EF]/60 mb-2">
                      ATS Match Score
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span
                        className="font-editorial text-6xl sm:text-7xl leading-none"
                        style={{
                          color: score >= 80 ? '#C7F36B' : score >= 60 ? '#FF6B35' : '#EF4444',
                        }}
                      >
                        {score}%
                      </span>
                    </div>
                    <span
                      className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                        score >= 80
                          ? 'bg-[#C7F36B] text-[#151515]'
                          : 'bg-[#FF6B35] text-white'
                      }`}
                    >
                      {score >= 80 ? 'Strong Match' : 'Needs Keyword Updates'}
                    </span>
                  </div>

                  <div className="md:col-span-8 space-y-2">
                    <h2 className="font-display font-bold text-xl text-[#F8F5EF]">
                      Alignment Summary
                    </h2>
                    <p className="text-sm sm:text-base text-[#F8F5EF]/85 leading-relaxed">
                      {analysisResult.summary}
                    </p>
                  </div>
                </div>
              </div>

              {/* Matched vs Missing Skills */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 border border-border-subtle">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="heading-card text-text-primary">
                      Matched Skills ({analysisResult.matchedSkills?.length || 0})
                    </h3>
                  </div>

                  {analysisResult.matchedSkills?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.matchedSkills.map((skill, idx) => (
                        <Badge key={idx} variant="success">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">
                      No direct skill matches detected from the job description.
                    </p>
                  )}
                </Card>

                <Card className="p-6 border border-border-subtle">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="heading-card text-text-primary">
                      Missing Keywords ({analysisResult.missingSkills?.length || 0})
                    </h3>
                  </div>

                  {analysisResult.missingSkills?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.missingSkills.map((skill, idx) => (
                        <Badge key={idx} variant="danger">
                          {skill}
                        </Badge>
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
              <Card className="p-6 border border-border-subtle">
                <div className="pb-4 mb-4 border-b border-border-subtle">
                  <h3 className="heading-card text-text-primary">Recommended Resume Edits</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Specific bullet and keyword adjustments to improve alignment with this role.
                  </p>
                </div>

                <ul className="space-y-3">
                  {analysisResult.recommendations?.map((rec, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 text-sm text-text-primary bg-bg-canvas p-4 rounded-[14px] border border-border-subtle"
                    >
                      <span className="font-mono text-xs font-bold text-[#FF6B35] flex-shrink-0 mt-0.5">
                        {idx + 1}.
                      </span>
                      <span className="leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ) : (
            <Card className="p-10 border border-border-subtle min-h-[500px] flex flex-col justify-center items-center text-center">
              <EvalixOrb size="lg" state="idle" />
              <h3 className="heading-card text-text-primary mt-5">
                Compare Your Resume Against Any Job Posting
              </h3>
              <p className="text-sm text-text-secondary mt-2 max-w-md">
                Upload your <strong className="text-text-primary font-semibold">PDF resume</strong> and paste the <strong className="text-text-primary font-semibold">target job description</strong> on the left to see matched skills, missing keywords, and specific bullet improvements.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResumeAnalyzer;
