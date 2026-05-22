import { SetMetadata } from '@nestjs/common';
import { METADATA_KEYS } from '@/modules/auth/constants/auth.constants';

export const Roles = (...roles: string[]) => SetMetadata(METADATA_KEYS.ROLES, roles);

