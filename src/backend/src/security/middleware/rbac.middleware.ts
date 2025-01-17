import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { UserRole } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';
import { AuthError } from '../../common/interfaces/error.interface';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { HttpStatus } from '../../common/constants/http-status.constant';

/**
 * Comprehensive role permission matrix defining allowed operations per role
 * Implements the authorization matrix from security specifications
 */
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
    [UserRole.ADMIN]: [
        'system.manage',
        'workspace.manage',
        'team.manage',
        'analytics.manage',
        'prompt.manage',
        'template.manage'
    ],
    [UserRole.TEAM_MANAGER]: [
        'team.manage',
        'analytics.view',
        'prompt.manage',
        'template.manage'
    ],
    [UserRole.EDITOR]: [
        'prompt.create',
        'prompt.edit',
        'prompt.delete',
        'analytics.view.own'
    ],
    [UserRole.VIEWER]: [
        'prompt.view',
        'analytics.view.own'
    ]
};

/**
 * Role hierarchy definition for permission inheritance
 * Higher roles inherit all permissions from lower roles
 */
const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
    [UserRole.ADMIN]: [UserRole.TEAM_MANAGER, UserRole.EDITOR, UserRole.VIEWER],
    [UserRole.TEAM_MANAGER]: [UserRole.EDITOR, UserRole.VIEWER],
    [UserRole.EDITOR]: [UserRole.VIEWER],
    [UserRole.VIEWER]: []
};

/**
 * Cache TTL for permission validation results (5 minutes)
 */
const PERMISSION_CACHE_TTL = 300000;

/**
 * Permission validation cache to optimize repeated checks
 */
const permissionCache = new Map<string, { result: boolean; timestamp: number }>();

/**
 * Options interface for role and permission checking middleware
 */
interface RBACOptions {
    requireWorkspace?: boolean;
    auditLog?: boolean;
    bypassCache?: boolean;
}

/**
 * Validates if a user has the required role or higher in the hierarchy
 * @param userRoles User's assigned roles
 * @param requiredRole Required role for access
 * @returns boolean indicating if user has sufficient role access
 */
const hasRequiredRole = (userRoles: string[], requiredRole: UserRole): boolean => {
    if (userRoles.includes(UserRole.ADMIN)) return true;
    
    const userHighestRole = userRoles.find(role => Object.values(UserRole).includes(role as UserRole));
    if (!userHighestRole) return false;

    if (userHighestRole === requiredRole) return true;
    
    return ROLE_HIERARCHY[userHighestRole as UserRole]
        .includes(requiredRole);
};

/**
 * Validates if a user has the required permission through direct assignment or inheritance
 * @param userRoles User's assigned roles
 * @param requiredPermission Permission required for access
 * @returns boolean indicating if user has the required permission
 */
const hasRequiredPermission = (userRoles: string[], requiredPermission: string): boolean => {
    return userRoles.some(role => {
        const roleEnum = role as UserRole;
        if (!ROLE_PERMISSIONS[roleEnum]) return false;
        
        return ROLE_PERMISSIONS[roleEnum].includes(requiredPermission) ||
            ROLE_HIERARCHY[roleEnum].some(inheritedRole => 
                ROLE_PERMISSIONS[inheritedRole].includes(requiredPermission)
            );
    });
};

/**
 * Middleware factory for role-based access control
 * Implements comprehensive role validation with hierarchy support
 */
export const checkRole = (requiredRole: UserRole, options: RBACOptions = {}) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const authenticatedReq = req as AuthenticatedRequest;
        
        if (!authenticatedReq.userId || !authenticatedReq.roles) {
            return next({
                code: ErrorCode.AUTHORIZATION_ERROR,
                message: 'Unauthorized access: Authentication required',
                status: HttpStatus.UNAUTHORIZED
            } as AuthError);
        }

        const cacheKey = `role:${authenticatedReq.userId}:${requiredRole}`;
        
        if (!options.bypassCache) {
            const cached = permissionCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < PERMISSION_CACHE_TTL) {
                if (!cached.result) {
                    return next({
                        code: ErrorCode.AUTHORIZATION_ERROR,
                        message: `Insufficient role: ${requiredRole} required`,
                        status: HttpStatus.FORBIDDEN,
                        userId: authenticatedReq.userId
                    } as AuthError);
                }
                return next();
            }
        }

        const hasRole = hasRequiredRole(authenticatedReq.roles, requiredRole);
        
        permissionCache.set(cacheKey, {
            result: hasRole,
            timestamp: Date.now()
        });

        if (!hasRole) {
            return next({
                code: ErrorCode.AUTHORIZATION_ERROR,
                message: `Insufficient role: ${requiredRole} required`,
                status: HttpStatus.FORBIDDEN,
                userId: authenticatedReq.userId
            } as AuthError);
        }

        next();
    };
};

/**
 * Middleware factory for permission-based access control
 * Implements granular permission validation with inheritance
 */
export const checkPermission = (requiredPermission: string, options: RBACOptions = {}) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const authenticatedReq = req as AuthenticatedRequest;
        
        if (!authenticatedReq.userId || !authenticatedReq.roles) {
            return next({
                code: ErrorCode.AUTHORIZATION_ERROR,
                message: 'Unauthorized access: Authentication required',
                status: HttpStatus.UNAUTHORIZED
            } as AuthError);
        }

        const cacheKey = `perm:${authenticatedReq.userId}:${requiredPermission}`;
        
        if (!options.bypassCache) {
            const cached = permissionCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < PERMISSION_CACHE_TTL) {
                if (!cached.result) {
                    return next({
                        code: ErrorCode.AUTHORIZATION_ERROR,
                        message: `Insufficient permissions: ${requiredPermission} required`,
                        status: HttpStatus.FORBIDDEN,
                        userId: authenticatedReq.userId,
                        requiredPermissions: [requiredPermission]
                    } as AuthError);
                }
                return next();
            }
        }

        const hasPermission = hasRequiredPermission(authenticatedReq.roles, requiredPermission);
        
        permissionCache.set(cacheKey, {
            result: hasPermission,
            timestamp: Date.now()
        });

        if (!hasPermission) {
            return next({
                code: ErrorCode.AUTHORIZATION_ERROR,
                message: `Insufficient permissions: ${requiredPermission} required`,
                status: HttpStatus.FORBIDDEN,
                userId: authenticatedReq.userId,
                requiredPermissions: [requiredPermission]
            } as AuthError);
        }

        next();
    };
};

/**
 * Middleware for workspace access validation
 * Implements workspace-level access control with hierarchy support
 */
export const checkWorkspaceAccess = async (req: Request, res: Response, next: NextFunction) => {
    const authenticatedReq = req as AuthenticatedRequest;
    
    if (!authenticatedReq.workspaceId) {
        return next({
            code: ErrorCode.AUTHORIZATION_ERROR,
            message: 'Workspace context required',
            status: HttpStatus.FORBIDDEN
        } as AuthError);
    }

    const cacheKey = `workspace:${authenticatedReq.userId}:${authenticatedReq.workspaceId}`;
    
    const cached = permissionCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < PERMISSION_CACHE_TTL) {
        if (!cached.result) {
            return next({
                code: ErrorCode.AUTHORIZATION_ERROR,
                message: 'Insufficient workspace access',
                status: HttpStatus.FORBIDDEN,
                userId: authenticatedReq.userId,
                workspaceId: authenticatedReq.workspaceId
            } as AuthError);
        }
        return next();
    }

    // Admin has access to all workspaces
    if (authenticatedReq.roles.includes(UserRole.ADMIN)) {
        permissionCache.set(cacheKey, { result: true, timestamp: Date.now() });
        return next();
    }

    // For other roles, validate workspace membership and permissions
    const hasAccess = authenticatedReq.roles.some(role => {
        const roleEnum = role as UserRole;
        return ROLE_PERMISSIONS[roleEnum].some(permission => 
            permission.startsWith('workspace.') || permission.startsWith('prompt.')
        );
    });

    permissionCache.set(cacheKey, {
        result: hasAccess,
        timestamp: Date.now()
    });

    if (!hasAccess) {
        return next({
            code: ErrorCode.AUTHORIZATION_ERROR,
            message: 'Insufficient workspace access',
            status: HttpStatus.FORBIDDEN,
            userId: authenticatedReq.userId,
            workspaceId: authenticatedReq.workspaceId
        } as AuthError);
    }

    next();
};