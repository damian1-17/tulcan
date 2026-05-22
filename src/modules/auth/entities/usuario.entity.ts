import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Token } from './token.entity';
import { Sesion } from './sesion.entity';
import { Rol } from './rol.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'id_usuario' })
  idUsuario: number;

  @Column({ type: 'varchar', length: 50, nullable: false })
  nombre: string;


  
  @Column({ type: 'varchar', length: 80, unique: true, nullable: false })
  email: string;

  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20, default: 'activo' })
  estado: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relaciones
  @OneToMany(() => Token, (token) => token.usuario)
  tokens: Token[];

  @OneToMany(() => Sesion, (sesion) => sesion.usuario)
  sesiones: Sesion[];

  @ManyToMany(() => Rol, (rol) => rol.usuarios)
  @JoinTable({
    name: 'usuarios_roles',
    joinColumn: { name: 'id_usuario', referencedColumnName: 'idUsuario' },
    inverseJoinColumn: { name: 'id_rol', referencedColumnName: 'idRol' },
  })
  roles: Rol[];
}