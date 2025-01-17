import mongoose, { Schema, Model, Document } from 'mongoose'; // v7.0.0
import * as validator from 'validator'; // v13.9.0
import * as bcrypt from 'bcrypt'; // v5.1.0
import * as crypto from 'crypto'; // v1.0.0
import { IUser, UserRole, UserStatus } from '../interfaces/user.interface';
import { hashPassword } from '../utils/crypto.util';
import { encryptField, decryptField } from '../../common/utils/encryption.util';

// Constants for security configurations
const PASSWORD_MIN_LENGTH = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_TIME = 30 * 60 * 1000; // 30 minutes
const ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY as string;

// Schema definition with enhanced security features
const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: (value: string) => validator.isEmail(value),
      message: 'Invalid email format'
    }
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`],
    select: false // Exclude password from queries by default
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    required: [true, 'Role is required'],
    default: UserRole.VIEWER
  },
  status: {
    type: String,
    enum: Object.values(UserStatus),
    required: [true, 'Status is required'],
    default: UserStatus.PENDING
  },
  workspaceId: {
    type: Schema.Types.ObjectId,
    required: [true, 'Workspace ID is required'],
    ref: 'Workspace'
  },
  mfaEnabled: {
    type: Boolean,
    default: false
  },
  mfaSecret: {
    type: String,
    select: false,
    get: (value: string) => value ? decryptField(value, Buffer.from(ENCRYPTION_KEY, 'base64')) : null,
    set: (value: string) => value ? encryptField(value, Buffer.from(ENCRYPTION_KEY, 'base64')) : null
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lastLoginAt: {
    type: Date
  },
  lastFailedLoginAt: {
    type: Date
  },
  accountLockedUntil: {
    type: Date
  },
  passwordLastChangedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true }
});

// Indexes for performance optimization and security
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ workspaceId: 1 });
userSchema.index({ status: 1 });
userSchema.index({ failedLoginAttempts: 1, accountLockedUntil: 1 });

// Pre-save middleware for security measures
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    // Validate password strength
    if (!validator.isStrongPassword(this.password, {
      minLength: PASSWORD_MIN_LENGTH,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    })) {
      throw new Error('Password does not meet security requirements');
    }

    // Hash password
    this.password = await hashPassword(this.password);
    this.passwordLastChangedAt = new Date();
    
    return next();
  } catch (error) {
    return next(error);
  }
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    
    if (!isMatch) {
      this.failedLoginAttempts += 1;
      this.lastFailedLoginAt = new Date();

      if (this.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
        this.status = UserStatus.LOCKED;
        this.accountLockedUntil = new Date(Date.now() + ACCOUNT_LOCK_TIME);
      }

      await this.save();
      return false;
    }

    // Reset security counters on successful login
    this.failedLoginAttempts = 0;
    this.lastLoginAt = new Date();
    this.accountLockedUntil = undefined;
    await this.save();

    return true;
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Static methods
userSchema.statics.findByEmail = async function(email: string): Promise<IUser | null> {
  if (!validator.isEmail(email)) {
    throw new Error('Invalid email format');
  }

  return this.findOne({
    email: email.toLowerCase(),
    status: { $ne: UserStatus.SUSPENDED },
    $or: [
      { accountLockedUntil: { $exists: false } },
      { accountLockedUntil: { $lt: new Date() } }
    ]
  });
};

userSchema.statics.findByWorkspace = async function(
  workspaceId: string,
  minRole: UserRole = UserRole.VIEWER
): Promise<IUser[]> {
  const roleHierarchy = [UserRole.VIEWER, UserRole.EDITOR, UserRole.TEAM_MANAGER, UserRole.ADMIN];
  const minRoleIndex = roleHierarchy.indexOf(minRole);

  return this.find({
    workspaceId,
    status: UserStatus.ACTIVE,
    role: { $in: roleHierarchy.slice(minRoleIndex) }
  }).select('-password -mfaSecret');
};

// Export the model
const UserModel = mongoose.model<IUser, Model<IUser>>('User', userSchema);
export default UserModel;