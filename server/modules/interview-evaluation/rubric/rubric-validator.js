const validateRubric = (rubric) => {
  if (!rubric) {
    return { valid: false, reason: 'RUBRIC_MISSING' };
  }

  const descriptors = Array.isArray(rubric.ratingDescriptors)
    ? rubric.ratingDescriptors
    : [];
  const hasAllFiveRatings = [1, 2, 3, 4, 5].every((rating) =>
    descriptors.some((d) => Number(d.rating) === rating && String(d.descriptor || '').trim().length > 0)
  );

  if (!hasAllFiveRatings) {
    return { valid: false, reason: 'RUBRIC_DESCRIPTORS_INCOMPLETE' };
  }

  return { valid: true, reason: null };
};

module.exports = {
  validateRubric,
};
