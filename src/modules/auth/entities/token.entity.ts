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

export enum TipoToken {
  ACCESS = 'access',
  REFRESH = 'refresh',
}

@Entity('tokens')
@Index('idx_token_hash', ['tokenHash'])
@Index('idx_usuario_tipo', ['usuario', 'tipo'])
export class Token {
  @PrimaryGeneratedColumn({ name: 'id_token', type: 'bigint' })
  idToken: string;

  @Column({ name: 'id_usuario', type: 'int', nullable: false })
  idUsuario: number;

  @Column({ name: 'token_hash', type: 'varchar', length: 255, nullable: false })
  tokenHash: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  tipo: TipoToken;

  @CreateDateColumn({ name: 'issued_at' })
  issuedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: false })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt?: Date;

  @Column({ name: 'revoked_by', type: 'int', nullable: true })
  revokedBy?: number | undefined;

  @Column({ type: 'jsonb', nullable: true })
  meta?: Record<string, any>;

  // Relaciones
  @ManyToOne(() => Usuario, (usuario) => usuario.tokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'revoked_by' })
  revokedByUser?: Usuario;
}