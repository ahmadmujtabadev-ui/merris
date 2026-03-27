export const USER_ROLES = [
  'owner',
  'admin',
  'manager',
  'analyst',
  'reviewer',
  'auditor_readonly',
] as const;

export type UserRoleConstant = (typeof USER_ROLES)[number];
