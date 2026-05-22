export interface AuthUser {
  idUsuario: number;
  email: string;
  nombre: string;
  roles: string[];
  permissions: string[];
  sessionId?: string | undefined;
}
