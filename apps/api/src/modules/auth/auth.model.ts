import mongoose, { Schema, Document } from 'mongoose';

// ============================================================
// User Model
// ============================================================

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  orgId: mongoose.Types.ObjectId;
  role: 'owner' | 'admin' | 'manager' | 'analyst' | 'reviewer' | 'auditor_readonly';
  permissions: Array<{
    resource: string;
    actions: Array<'read' | 'write' | 'delete' | 'approve'>;
  }>;
  mfaEnabled: boolean;
  ssoProvider?: string;
  preferences: {
    language: 'en' | 'ar';
    timezone: string;
    notifications: {
      email: boolean;
      inApp: boolean;
      teams: boolean;
    };
  };
  teamIds: mongoose.Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    role: {
      type: String,
      enum: ['owner', 'admin', 'manager', 'analyst', 'reviewer', 'auditor_readonly'],
      required: true,
    },
    permissions: [
      {
        resource: { type: String, required: true },
        actions: [{ type: String, enum: ['read', 'write', 'delete', 'approve'] }],
      },
    ],
    mfaEnabled: { type: Boolean, default: false },
    ssoProvider: { type: String },
    preferences: {
      language: { type: String, enum: ['en', 'ar'], default: 'en' },
      timezone: { type: String, default: 'UTC' },
      notifications: {
        email: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
        teams: { type: Boolean, default: false },
      },
    },
    teamIds: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

UserSchema.index({ orgId: 1, email: 1 });
UserSchema.index({ orgId: 1, role: 1 });

export const UserModel = mongoose.model<IUser>('User', UserSchema);

// ============================================================
// Organization Model
// ============================================================

export interface IOrganization extends Document {
  name: string;
  type: 'consulting' | 'corporate' | 'regulator';
  plan: 'starter' | 'professional' | 'enterprise';
  region: string;
  industry: string;
  size: string;
  settings: {
    language: 'en' | 'ar';
    timezone: string;
    currency: string;
  };
  branding: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['consulting', 'corporate', 'regulator'], required: true },
    plan: { type: String, enum: ['starter', 'professional', 'enterprise'], default: 'starter' },
    region: { type: String, default: '' },
    industry: { type: String, default: '' },
    size: { type: String, default: '' },
    settings: {
      language: { type: String, enum: ['en', 'ar'], default: 'en' },
      timezone: { type: String, default: 'UTC' },
      currency: { type: String, default: 'USD' },
    },
    branding: {
      logo: { type: String },
      primaryColor: { type: String },
      secondaryColor: { type: String },
      fontFamily: { type: String },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const OrganizationModel = mongoose.model<IOrganization>('Organization', OrganizationSchema);

// ============================================================
// Team Model
// ============================================================

export interface ITeam extends Document {
  name: string;
  orgId: mongoose.Types.ObjectId;
  description?: string;
  memberIds: mongoose.Types.ObjectId[];
  leadId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    description: { type: String },
    memberIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    leadId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

TeamSchema.index({ orgId: 1 });

export const TeamModel = mongoose.model<ITeam>('Team', TeamSchema);
