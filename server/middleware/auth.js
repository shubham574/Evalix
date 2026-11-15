const crypto = require('crypto');
const { getAuth } = require('@clerk/express');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const RECRUITER_ROLES = new Set([
  'org:admin',
  'org:recruiter',
  'org:reviewer',
  'RECRUITER',
  'REVIEWER',
  'ADMIN',
]);

const PLATFORM_ADMIN_ROLES = new Set([
  'org:platform_admin',
  'platform_admin',
  'PLATFORM_ADMIN',
]);

const protect = (req, res, next) => {
  try {
    // Several routers share one mount path (each calls protect). protect overwrites
    // req.auth with a plain object, which breaks Clerk's getAuth on later calls,
    // so skip if already authenticated by an earlier protect in this request.
    if (req.auth && req.auth.__protected === true) {
      return next();
    }

    // Allow test auth bypass ONLY in non-production or when explicitly enabled
    if (
      (process.env.NODE_ENV !== 'production' || process.env.ENABLE_TEST_AUTH === 'true') &&
      (req.headers['x-test-user-id'] || req.headers['authorization'] === 'Bearer test-token')
    ) {
      const testRole =
        req.headers['x-test-org-role'] || req.headers['x-user-role'] || null;
      req.auth = {
        userId: req.headers['x-test-user-id'] || 'test_user_loadtest',
        orgId: req.headers['x-test-org-id'] || null,
        orgRole: testRole ? String(testRole) : null,
        orgPermissions: [],
        isTestAuth: true,
        __protected: true,
      };
      return next();
    }

    const auth = getAuth(req);
    const userId = auth?.userId;

    if (!userId) {
      return next(new ApiError(401, 'Not authorized - please sign in'));
    }

    const orgId = auth?.orgId || auth?.sessionClaims?.org_id || null;
    const orgRole = auth?.orgRole || auth?.sessionClaims?.org_role || null;
    const orgPermissions = Array.isArray(auth?.orgPermissions)
      ? auth.orgPermissions
      : Array.isArray(auth?.sessionClaims?.org_permissions)
      ? auth.sessionClaims.org_permissions
      : [];

    req.auth = {
      userId,
      orgId,
      orgRole,
      orgPermissions,
      isTestAuth: false,
      __protected: true,
    };
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return next(new ApiError(401, 'Authentication failed - please sign in again'));
  }
};

const hasRecruiterAuthority = (auth) => {
  if (!auth || !auth.userId || !auth.orgId) return false;
  if (RECRUITER_ROLES.has(String(auth.orgRole || ''))) return true;
  if (
    Array.isArray(auth.orgPermissions) &&
    (auth.orgPermissions.includes('org:recruiter:access') ||
      auth.orgPermissions.includes('org:evaluation:read'))
  ) {
    return true;
  }
  return false;
};

const requireRecruiter = (req, _res, next) => {
  if (!hasRecruiterAuthority(req.auth)) {
    return next(
      new ApiError(
        403,
        'Verified recruiter organization membership and role required'
      )
    );
  }
  return next();
};

const requireOrganizationMembership = (paramName = 'organizationId') => (req, _res, next) => {
  if (!hasRecruiterAuthority(req.auth)) {
    return next(
      new ApiError(
        403,
        'Verified recruiter organization membership and role required'
      )
    );
  }
  const targetOrgId = req.params?.[paramName];
  if (targetOrgId && targetOrgId !== req.auth.orgId) {
    return next(
      new ApiError(403, 'Cross-organization access is forbidden')
    );
  }
  return next();
};

const isValidInternalPlatformToken = (providedToken) => {
  const expected = String(env.PLATFORM_ADMIN_SECRET || '');
  const provided = String(providedToken || '');
  if (!expected || !provided) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const hasPlatformAdminAuthority = (auth) => {
  if (!auth || !auth.userId) return false;
  if (PLATFORM_ADMIN_ROLES.has(String(auth.orgRole || ''))) return true;
  if (
    Array.isArray(auth.orgPermissions) &&
    (auth.orgPermissions.includes('platform:admin') ||
      auth.orgPermissions.includes('org:platform_admin'))
  ) {
    return true;
  }
  return false;
};

const requirePlatformAdmin = (req, res, next) => {
  const tokenHeader = req.headers['x-internal-platform-token'];
  if (tokenHeader !== undefined) {
    if (isValidInternalPlatformToken(tokenHeader)) {
      req.internalServiceAuth = { isPlatformAdmin: true, via: 'INTERNAL_TOKEN' };
      return next();
    }
    return next(new ApiError(403, 'Invalid internal platform credential', 'INTERNAL_AUTH_FORBIDDEN'));
  }

  return protect(req, res, (authErr) => {
    if (authErr) return next(authErr);
    if (!hasPlatformAdminAuthority(req.auth)) {
      return next(
        new ApiError(
          403,
          'Platform administrator permission required',
          'PLATFORM_ADMIN_FORBIDDEN'
        )
      );
    }
    return next();
  });
};

module.exports = {
  protect,
  requireRecruiter,
  requireOrganizationMembership,
  requirePlatformAdmin,
  hasRecruiterAuthority,
  hasPlatformAdminAuthority,
  isValidInternalPlatformToken,
  RECRUITER_ROLES,
  PLATFORM_ADMIN_ROLES,
};
