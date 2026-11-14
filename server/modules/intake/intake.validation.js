const { z } = require('zod');
const { JOB_TYPES } = require('../job-profile/targetJobProfile.model');
const { INTERVIEW_TYPES, INTERVIEW_DIFFICULTIES, INTAKE_STATUSES } = require('./interviewIntake.model');

const targetJobSchema = z.object({
  role: z.string().trim().min(2, 'Target role must be at least 2 characters').max(160),
  company: z.string().trim().max(160).optional().nullable(),
  experienceRequired: z.string().trim().max(80).optional().nullable(),
  jobDescription: z.string().trim().max(30000).optional().default(''),
  jobLocation: z.string().trim().max(160).optional().nullable(),
  jobType: z.enum(JOB_TYPES).optional().nullable(),
});

const interviewPreferencesSchema = z.object({
  interviewType: z.enum(INTERVIEW_TYPES).default('MIXED'),
  durationMinutes: z.coerce.number().int().min(15).max(120).default(45),
  difficulty: z.enum(INTERVIEW_DIFFICULTIES).default('ADAPTIVE'),
  focusAreas: z.array(z.string().trim().min(1).max(80)).max(15).default([]),
});

const createIntakeSchema = z.object({
  targetJob: targetJobSchema,
  interviewPreferences: interviewPreferencesSchema.default({}),
});

const updateIntakeSchema = z
  .object({
    targetJob: targetJobSchema.partial().optional(),
    interviewPreferences: interviewPreferencesSchema.partial().optional(),
    expectedVersion: z.coerce.number().int().min(1).optional(),
  })
  .refine((d) => d.targetJob !== undefined || d.interviewPreferences !== undefined, {
    message: 'Provide targetJob or interviewPreferences to update',
  });

const listIntakesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(INTAKE_STATUSES).optional(),
});

module.exports = {
  createIntakeSchema,
  updateIntakeSchema,
  listIntakesQuerySchema,
};
