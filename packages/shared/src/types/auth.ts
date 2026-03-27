import { z } from 'zod';
import {
  UserSchema,
  UserRoleSchema,
  PermissionSchema,
  UserPreferencesSchema,
  NotificationSettingsSchema,
} from '../validators/schemas.js';

export type User = z.infer<typeof UserSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;
