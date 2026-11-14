const { z } = require('zod');
const { EXPERIENCE_LEVELS } = require('./candidateProfile.model');
const { EMPLOYMENT_TYPES } = require('./candidateExperience.model');
const { SKILL_CATEGORIES, PROFICIENCY_LEVELS } = require('./candidateSkill.model');

const phoneRegex = /^[+]?[\d\s()-]{7,20}$/;

const createProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  email: z.string().trim().email('Valid email address is required').max(254),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Invalid phone number format')
    .optional()
    .nullable(),
  currentJobTitle: z.string().trim().min(1).max(120).optional().nullable(),
  totalExperienceMonths: z.coerce.number().int().min(0).max(720).default(0),
  experienceLevel: z.enum(EXPERIENCE_LEVELS).default('JUNIOR'),
  professionalSummary: z.string().trim().max(3000).optional().nullable(),
});

const updateProfileSchema = createProfileSchema
  .partial()
  .extend({
    expectedVersion: z.coerce.number().int().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

const experienceBaseSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required').max(160),
  jobTitle: z.string().trim().min(1, 'Job title is required').max(120),
  employmentType: z.enum(EMPLOYMENT_TYPES).default('FULL_TIME'),
  startDate: z.coerce.date({ message: 'Valid start date is required' }),
  endDate: z.coerce.date({ message: 'Valid end date is required' }).optional().nullable(),
  isCurrent: z.boolean().default(false),
  description: z.string().trim().max(3000).default(''),
});

const validateExperienceDates = (data, ctx) => {
  if (data.isCurrent && data.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'Current employment cannot have an end date',
    });
  }
  if (!data.isCurrent && !data.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'End date is required when not currently employed here',
    });
  }
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'End date cannot be earlier than start date',
    });
  }
};

const addExperienceSchema = experienceBaseSchema.superRefine(validateExperienceDates);

const skillItemSchema = z.object({
  skillName: z.string().trim().min(1, 'Skill name is required').max(80),
  skillCategory: z.enum(SKILL_CATEGORIES).default('OTHER'),
  selfReportedProficiency: z.enum(PROFICIENCY_LEVELS).default('INTERMEDIATE'),
});

// Support single skill object or { skills: [...] } array
const addSkillsSchema = z.union([
  skillItemSchema,
  z.object({
    skills: z.array(skillItemSchema).min(1, 'Provide at least one skill').max(50),
  }),
]);

const updateSkillSchema = skillItemSchema.partial().refine((d) => Object.keys(d).length > 0, {
  message: 'At least one skill field must be provided',
});

const addProjectSchema = z.object({
  projectTitle: z.string().trim().min(2, 'Project title is required').max(160),
  projectDescription: z.string().trim().min(5, 'Project description is required').max(3000),
  technologies: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  projectUrl: z
    .string()
    .trim()
    .url('Project URL must be a valid http/https URL')
    .refine((val) => /^https?:\/\//i.test(val), 'Project URL must use http or https')
    .optional()
    .nullable(),
  candidateResponsibility: z.string().trim().max(1500).optional().nullable(),
});

const updateProjectSchema = addProjectSchema.partial().refine((d) => Object.keys(d).length > 0, {
  message: 'At least one project field must be provided',
});

module.exports = {
  createProfileSchema,
  updateProfileSchema,
  addExperienceSchema,
  addSkillsSchema,
  updateSkillSchema,
  addProjectSchema,
  updateProjectSchema,
};
