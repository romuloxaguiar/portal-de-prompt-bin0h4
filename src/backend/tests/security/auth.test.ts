import { MongoMemoryServer } from 'mongodb-memory-server'; // v8.12.0
import { AuthService } from '../../src/security/services/auth.service';
import { TokenService } from '../../src/security/services/token.service';
import UserModel from '../../src/security/models/user.model';
import { UserRole, UserStatus } from '../../src/security/interfaces/user.interface';
import { ErrorCode } from '../../src/common/constants/error-codes.constant';
import { HttpStatus } from '../../src/common/constants/http-status.constant';
import { Logger } from '../../src/common/utils/logger.util';

// Test timeout configuration
const TEST_TIMEOUT = 30000;

describe('AuthService Integration Tests', () => {
  let authService: AuthService;
  let tokenService: TokenService;
  let mongoServer: MongoMemoryServer;
  let logger: Logger;

  // Test user data
  const validUser = {
    email: 'test@example.com',
    password: 'Test123!@#',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.EDITOR,
    status: UserStatus.ACTIVE,
    mfaEnabled: true,
    mfaSecret: 'JBSWY3DPEHPK3PXP'
  };

  const invalidUser = {
    email: 'invalid@example.com',
    password: 'wrong',
    status: UserStatus.INACTIVE,
    mfaEnabled: false
  };

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    
    // Initialize services
    authService = new AuthService();
    tokenService = new TokenService();
    logger = new Logger('AuthServiceTest');
  });

  beforeEach(async () => {
    // Clear database and create test user
    await UserModel.deleteMany({});
    await UserModel.create(validUser);
  });

  afterAll(async () => {
    await mongoServer.stop();
  });

  describe('Authentication Flow', () => {
    it('should successfully authenticate with valid credentials and MFA', async () => {
      const result = await authService.login(
        validUser.email,
        validUser.password,
        '123456' // Valid MFA token
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toHaveProperty('email', validUser.email);
      expect(result.user).toHaveProperty('role', validUser.role);
    }, TEST_TIMEOUT);

    it('should fail authentication with invalid credentials', async () => {
      await expect(
        authService.login(invalidUser.email, invalidUser.password)
      ).rejects.toThrow('Invalid credentials');
    });

    it('should require MFA token when MFA is enabled', async () => {
      await expect(
        authService.login(validUser.email, validUser.password)
      ).rejects.toThrow('MFA token required');
    });

    it('should reject invalid MFA tokens', async () => {
      await expect(
        authService.login(validUser.email, validUser.password, 'invalid')
      ).rejects.toThrow('Invalid MFA token');
    });

    it('should enforce rate limiting on failed attempts', async () => {
      const attempts = 6;
      const promises = Array(attempts).fill(null).map(() =>
        authService.login(validUser.email, 'wrongpassword')
          .catch(error => error)
      );

      const results = await Promise.all(promises);
      const lastError = results[attempts - 1];
      
      expect(lastError).toBeDefined();
      expect(lastError.message).toContain('Too many requests');
    });

    it('should successfully refresh access token', async () => {
      const auth = await authService.login(
        validUser.email,
        validUser.password,
        '123456'
      );

      const refreshResult = await authService.refreshToken(auth.refreshToken);
      expect(refreshResult).toHaveProperty('accessToken');
      
      const decoded = await tokenService.verifyToken(refreshResult.accessToken);
      expect(decoded).toHaveProperty('sub');
      expect(decoded).toHaveProperty('type', 'access');
    });
  });

  describe('Security Controls', () => {
    it('should lock account after maximum failed attempts', async () => {
      const maxAttempts = 5;
      
      for (let i = 0; i < maxAttempts; i++) {
        await authService.login(validUser.email, 'wrongpassword')
          .catch(() => {});
      }

      const user = await UserModel.findOne({ email: validUser.email });
      expect(user.status).toBe(UserStatus.LOCKED);
      expect(user.failedLoginAttempts).toBe(maxAttempts);
    });

    it('should prevent concurrent login attempts', async () => {
      const concurrentAttempts = 3;
      const promises = Array(concurrentAttempts).fill(null).map(() =>
        authService.login(validUser.email, validUser.password, '123456')
      );

      const results = await Promise.allSettled(promises);
      const successfulAttempts = results.filter(r => r.status === 'fulfilled');
      
      expect(successfulAttempts.length).toBe(1);
    });

    it('should validate token blacklisting', async () => {
      const auth = await authService.login(
        validUser.email,
        validUser.password,
        '123456'
      );

      await authService.revokeToken(auth.accessToken);

      await expect(
        authService.validateToken(auth.accessToken)
      ).rejects.toThrow('Token has been revoked');
    });

    it('should enforce password complexity requirements', async () => {
      const weakPassword = 'password123';
      
      await expect(
        authService.register({
          ...validUser,
          password: weakPassword
        })
      ).rejects.toThrow('Password does not meet security requirements');
    });

    it('should properly handle inactive accounts', async () => {
      await UserModel.updateOne(
        { email: validUser.email },
        { status: UserStatus.INACTIVE }
      );

      await expect(
        authService.login(validUser.email, validUser.password, '123456')
      ).rejects.toThrow('Account is inactive');
    });
  });

  describe('Token Management', () => {
    it('should validate token structure and claims', async () => {
      const auth = await authService.login(
        validUser.email,
        validUser.password,
        '123456'
      );

      const decoded = await tokenService.verifyToken(auth.accessToken);
      
      expect(decoded).toHaveProperty('sub');
      expect(decoded).toHaveProperty('email', validUser.email);
      expect(decoded).toHaveProperty('role', validUser.role);
      expect(decoded).toHaveProperty('type', 'access');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
    });

    it('should handle token expiration correctly', async () => {
      const auth = await authService.login(
        validUser.email,
        validUser.password,
        '123456'
      );

      // Mock token expiration
      jest.spyOn(TokenService.prototype, 'verifyToken')
        .mockRejectedValueOnce(new Error('Token has expired'));

      await expect(
        authService.validateToken(auth.accessToken)
      ).rejects.toThrow('Token has expired');
    });

    it('should maintain token blacklist effectively', async () => {
      const auth = await authService.login(
        validUser.email,
        validUser.password,
        '123456'
      );

      await authService.revokeToken(auth.accessToken);
      await authService.revokeToken(auth.refreshToken);

      await expect(
        authService.validateToken(auth.accessToken)
      ).rejects.toThrow('Token has been revoked');

      await expect(
        authService.refreshToken(auth.refreshToken)
      ).rejects.toThrow('Token has been revoked');
    });
  });

  describe('Audit Logging', () => {
    it('should log security events properly', async () => {
      const logSpy = jest.spyOn(logger, 'info');
      
      await authService.login(
        validUser.email,
        validUser.password,
        '123456'
      );

      expect(logSpy).toHaveBeenCalledWith(
        'Successful login',
        expect.objectContaining({
          userId: expect.any(String)
        })
      );
    });

    it('should log security failures with appropriate level', async () => {
      const errorSpy = jest.spyOn(logger, 'error');
      
      await authService.login(validUser.email, 'wrongpassword')
        .catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith(
        'Login failed',
        expect.objectContaining({
          code: ErrorCode.AUTHENTICATION_ERROR,
          status: HttpStatus.UNAUTHORIZED
        })
      );
    });
  });
});