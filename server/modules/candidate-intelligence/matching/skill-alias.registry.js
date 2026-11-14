const ALIAS_REGISTRY_VERSION = '1.0.0';

/**
 * Versioned canonical skill alias registry.
 * Keys are normalized lowercase tokens; values map to canonical names & categories.
 */
const SKILL_ALIAS_ENTRIES = [
  { canonical: 'JavaScript', category: 'PROGRAMMING_LANGUAGE', aliases: ['js', 'javascript', 'ecmascript', 'es6', 'es2015'] },
  { canonical: 'TypeScript', category: 'PROGRAMMING_LANGUAGE', aliases: ['ts', 'typescript'] },
  { canonical: 'Python', category: 'PROGRAMMING_LANGUAGE', aliases: ['python', 'py', 'python3'] },
  { canonical: 'Java', category: 'PROGRAMMING_LANGUAGE', aliases: ['java', 'jdk'] },
  { canonical: 'Go', category: 'PROGRAMMING_LANGUAGE', aliases: ['go', 'golang'] },
  { canonical: 'Node.js', category: 'FRAMEWORK', aliases: ['node', 'nodejs', 'node.js', 'node js'] },
  { canonical: 'Express.js', category: 'FRAMEWORK', aliases: ['express', 'expressjs', 'express.js'] },
  { canonical: 'React', category: 'FRAMEWORK', aliases: ['react', 'reactjs', 'react.js'] },
  { canonical: 'Next.js', category: 'FRAMEWORK', aliases: ['next', 'nextjs', 'next.js'] },
  { canonical: 'PostgreSQL', category: 'DATABASE', aliases: ['postgres', 'postgresql', 'psql', 'pg'] },
  { canonical: 'MongoDB', category: 'DATABASE', aliases: ['mongo', 'mongodb', 'mongoose'] },
  { canonical: 'Redis', category: 'DATABASE', aliases: ['redis'] },
  { canonical: 'MySQL', category: 'DATABASE', aliases: ['mysql'] },
  { canonical: 'AWS', category: 'CLOUD', aliases: ['aws', 'amazon web services'] },
  { canonical: 'GCP', category: 'CLOUD', aliases: ['gcp', 'google cloud', 'google cloud platform'] },
  { canonical: 'Azure', category: 'CLOUD', aliases: ['azure', 'microsoft azure'] },
  { canonical: 'Docker', category: 'DEVOPS', aliases: ['docker', 'containerization'] },
  { canonical: 'Kubernetes', category: 'DEVOPS', aliases: ['k8s', 'kubernetes'] },
  { canonical: 'REST APIs', category: 'FUNCTIONAL', aliases: ['rest', 'rest api', 'rest apis', 'restful', 'restful api', 'restful apis'] },
  { canonical: 'GraphQL', category: 'FUNCTIONAL', aliases: ['graphql'] },
  { canonical: 'Microservices', category: 'FUNCTIONAL', aliases: ['microservices', 'microservice architecture'] },
  { canonical: 'JWT', category: 'TOOL', aliases: ['jwt', 'json web token', 'json web tokens'] },
  { canonical: 'Git', category: 'TOOL', aliases: ['git', 'github', 'gitlab'] },
  { canonical: 'CI/CD', category: 'DEVOPS', aliases: ['ci/cd', 'cicd', 'ci cd', 'github actions'] },
  { canonical: 'Stripe', category: 'TOOL', aliases: ['stripe', 'stripe payments'] },
];

const normalizeSkillToken = (raw) =>
  String(raw || '')
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/[^\w.\s+-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const ALIAS_LOOKUP = new Map();
for (const entry of SKILL_ALIAS_ENTRIES) {
  for (const alias of entry.aliases) {
    ALIAS_LOOKUP.set(normalizeSkillToken(alias), {
      canonicalName: entry.canonical,
      category: entry.category,
      mappingSource: 'ALIAS_REGISTRY',
      registryVersion: ALIAS_REGISTRY_VERSION,
    });
  }
}

/**
 * Resolve a raw skill string against the versioned alias registry.
 * Unknown skills are NOT forced into unrelated canonical names.
 */
const resolveSkillAlias = (rawSkill) => {
  const token = normalizeSkillToken(rawSkill);
  if (!token) {
    return {
      raw: rawSkill || '',
      normalizedToken: '',
      canonicalName: '',
      category: 'OTHER',
      isKnownAlias: false,
      mappingSource: 'UNMAPPED',
      registryVersion: ALIAS_REGISTRY_VERSION,
    };
  }

  const hit = ALIAS_LOOKUP.get(token);
  if (hit) {
    return {
      raw: rawSkill,
      normalizedToken: token,
      canonicalName: hit.canonicalName,
      category: hit.category,
      isKnownAlias: true,
      mappingSource: hit.mappingSource,
      registryVersion: hit.registryVersion,
    };
  }

  return {
    raw: rawSkill,
    normalizedToken: token,
    canonicalName: String(rawSkill).trim(),
    category: 'OTHER',
    isKnownAlias: false,
    mappingSource: 'RAW_NORMALIZED',
    registryVersion: ALIAS_REGISTRY_VERSION,
  };
};

module.exports = {
  ALIAS_REGISTRY_VERSION,
  SKILL_ALIAS_ENTRIES,
  normalizeSkillToken,
  resolveSkillAlias,
};
