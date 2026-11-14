const asyncHandler = require('../../utils/asyncHandler');
const intakeService = require('./intake.service');

exports.createIntake = asyncHandler(async (req, res) => {
  const data = await intakeService.createInterviewIntake(req.auth.userId, req.body);
  res.status(201).json({
    success: true,
    message: 'Interview intake created successfully',
    data,
  });
});

exports.listIntakes = asyncHandler(async (req, res) => {
  const data = await intakeService.listInterviewIntakes(req.auth.userId, req.query);
  res.status(200).json({
    success: true,
    message: 'Interview intakes retrieved successfully',
    data,
  });
});

exports.getIntake = asyncHandler(async (req, res) => {
  const data = await intakeService.getInterviewIntake(req.auth.userId, req.params.intakeId);
  res.status(200).json({
    success: true,
    message: 'Interview intake retrieved successfully',
    data,
  });
});

exports.updateIntake = asyncHandler(async (req, res) => {
  const data = await intakeService.updateInterviewIntake(
    req.auth.userId,
    req.params.intakeId,
    req.body
  );
  res.status(200).json({
    success: true,
    message: 'Interview intake updated successfully',
    data,
  });
});

exports.createRevision = asyncHandler(async (req, res) => {
  const data = await intakeService.createIntakeRevision(req.auth.userId, req.params.intakeId);
  res.status(201).json({
    success: true,
    message: 'Interview intake draft revision created successfully',
    data,
  });
});

exports.uploadResume = asyncHandler(async (req, res) => {
  const data = await intakeService.uploadIntakeResume(
    req.auth.userId,
    req.params.intakeId,
    req.file
  );
  res.status(200).json({
    success: true,
    message: data.deduplicated
      ? 'Identical resume already uploaded and linked to intake'
      : 'Resume uploaded and validated successfully',
    data,
  });
});

exports.uploadJobDescription = asyncHandler(async (req, res) => {
  const data = await intakeService.uploadIntakeJobDescription(
    req.auth.userId,
    req.params.intakeId,
    req.file
  );
  res.status(200).json({
    success: true,
    message: data.deduplicated
      ? 'Identical job description already uploaded and linked to intake'
      : 'Job description document uploaded and validated successfully',
    data,
  });
});

exports.submitIntake = asyncHandler(async (req, res) => {
  const data = await intakeService.submitInterviewIntake(req.auth.userId, req.params.intakeId);
  res.status(200).json({
    success: true,
    message: 'Interview intake submitted and ready for analysis',
    data,
  });
});
