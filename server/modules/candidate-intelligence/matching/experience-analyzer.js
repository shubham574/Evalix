const toMonthIndex = (dateObj, isEnd = false, now = new Date()) => {
  if (!dateObj) return null;
  if (typeof dateObj === 'string') {
    const parsed = new Date(dateObj);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.getUTCFullYear() * 12 + parsed.getUTCMonth();
  }

  // Module 2 DateFieldSchema: { raw, normalized, precision }
  if (dateObj.precision === 'OPEN_ENDED') {
    return now.getUTCFullYear() * 12 + now.getUTCMonth();
  }
  const str = dateObj.normalized || dateObj.raw;
  if (!str) return null;

  if (/^\d{4}$/.test(String(str).trim())) {
    const year = Number(str.trim());
    // Conservative: for year-only, treat start as Jan (or end as Jan of that year / conservative 0-month span unless distinct years)
    return isEnd ? year * 12 + 0 : year * 12 + 0;
  }

  const ym = String(str).trim().match(/^(\d{4})-(\d{2})/);
  if (ym) {
    return Number(ym[1]) * 12 + (Number(ym[2]) - 1);
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getUTCFullYear() * 12 + parsed.getUTCMonth();
};

const mergeIntervals = (intervals) => {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [sorted[0].slice()];
  for (let i = 1; i < sorted.length; i++) {
    const [start, end] = sorted[i];
    const last = merged[merged.length - 1];
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
};

const sumMergedMonths = (intervals) =>
  mergeIntervals(intervals).reduce((sum, [s, e]) => sum + Math.max(0, e - s + 1), 0);

/**
 * Conservative experience timeline analyzer:
 * - Merges overlapping intervals instead of double-counting concurrent jobs
 * - Separates internships from full-time/contract professional experience
 * - Never invents missing months; marks incomplete dates as PARTIALLY_VERIFIABLE / INSUFFICIENT_DATES
 */
const analyzeExperience = ({
  facts = [],
  reportedExperienceMonths = null,
  jobRequiredMinimumMonths = null,
  now = new Date(),
}) => {
  const employmentFacts = facts.filter((f) => f.factType === 'EMPLOYMENT');
  const resumeEmployments = employmentFacts.filter((f) => f.sourceType === 'RESUME_EXTRACTED');
  const sourceEmployments = resumeEmployments.length > 0 ? resumeEmployments : employmentFacts;

  const professionalIntervals = [];
  const internshipIntervals = [];
  const supportingEmploymentIds = [];
  let missingDateCount = 0;
  let yearOnlyCount = 0;

  for (const emp of sourceEmployments) {
    const meta = emp.metadata || {};
    const startIdx = toMonthIndex(meta.startDate, false, now);
    const endIdx = meta.isCurrent
      ? now.getUTCFullYear() * 12 + now.getUTCMonth()
      : toMonthIndex(meta.endDate, true, now);

    if (meta.startDate?.precision === 'YEAR' || meta.endDate?.precision === 'YEAR') {
      yearOnlyCount += 1;
    }

    if (startIdx === null || endIdx === null || endIdx < startIdx) {
      missingDateCount += 1;
      continue;
    }

    supportingEmploymentIds.push(emp.factId);
    const isInternship = String(meta.employmentType || '').toUpperCase() === 'INTERNSHIP';
    if (isInternship) {
      internshipIntervals.push([startIdx, endIdx]);
    } else {
      professionalIntervals.push([startIdx, endIdx]);
    }
  }

  const derivedExperienceMonths = sumMergedMonths(professionalIntervals);
  const internshipMonths = sumMergedMonths(internshipIntervals);

  let derivationStatus = 'VERIFIED';
  if (sourceEmployments.length === 0 || (professionalIntervals.length === 0 && internshipIntervals.length === 0)) {
    derivationStatus = 'INSUFFICIENT_DATES';
  } else if (missingDateCount > 0 || yearOnlyCount > 0) {
    derivationStatus = 'PARTIALLY_VERIFIABLE';
  }

  let assessment = 'NOT_APPLICABLE';
  if (typeof jobRequiredMinimumMonths === 'number' && jobRequiredMinimumMonths > 0) {
    if (derivationStatus === 'INSUFFICIENT_DATES') {
      assessment = 'REQUIRES_CANDIDATE_CONFIRMATION';
    } else if (derivedExperienceMonths >= jobRequiredMinimumMonths) {
      assessment = 'SUPPORTED_DIRECTLY';
    } else if (
      typeof reportedExperienceMonths === 'number' &&
      reportedExperienceMonths >= jobRequiredMinimumMonths &&
      derivedExperienceMonths < jobRequiredMinimumMonths
    ) {
      assessment = 'REQUIRES_CANDIDATE_CONFIRMATION';
    } else if (derivedExperienceMonths > 0) {
      assessment = 'PARTIALLY_SUPPORTED';
    } else {
      assessment = 'NOT_EVIDENCED';
    }
  }

  return {
    reportedExperienceMonths,
    derivedExperienceMonths,
    internshipMonths,
    derivationStatus,
    jobRequiredMinimumMonths,
    assessment,
    supportingEmploymentIds,
    missingDateEntries: missingDateCount,
    yearOnlyEntries: yearOnlyCount,
  };
};

module.exports = {
  analyzeExperience,
  mergeIntervals,
};
