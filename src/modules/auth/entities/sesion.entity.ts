import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('sesiones')
@Index('idx_sesiones_usuario', ['usuario'])
@Index('idx_sesiones_expires', ['expiresAt'])
export class Sesion {
  @PrimaryGeneratedColumn('uuid', { name: 'id_sesion' })
  idSesion: string;

  @Column({ name: 'id_usuario', type: 'int', nullable: false })
  idUsuario: number;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent?: string | undefined;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip?: string  | undefined;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'last_seen_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastSeenAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: false })
  expiresAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, any> | undefined;

  // Relaciones
  @ManyToOne(() => Usuario, (usuario) => usuario.sesiones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;
}