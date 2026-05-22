// src/modules/auth/decorators/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { METADATA_KEYS } from '@/modules/auth/constants/auth.constants';

export const Permissions = (...permissions: string[]) => 
  SetMetadata(METADATA_KEYS.PERMISSIONS, permissions);
