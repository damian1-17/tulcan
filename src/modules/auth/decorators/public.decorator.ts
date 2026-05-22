import { SetMetadata } from '@nestjs/common';
import { METADATA_KEYS } from '@/modules/auth/constants/auth.constants';

export const Public = () => SetMetadata(METADATA_KEYS.IS_PUBLIC, true);

// src/modules/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '@/modules/auth/interfaces/auth-user.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    
    return data ? user?.[data] : user;
  },
);
