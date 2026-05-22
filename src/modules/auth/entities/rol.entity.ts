import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { Permiso } from './permiso.entity';

@Entity('roles')
export class Rol {
  @PrimaryGeneratedColumn({ name: 'id_rol' })
  idRol: number;

  @Column({ type: 'varchar', length: 80, unique: true, nullable: false })
  nombre: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  descripcion: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relaciones
  @ManyToMany(() => Usuario, (usuario:Usuario) => usuario.roles)
  usuarios: Usuario[];

  @ManyToMany(() => Permiso, (permiso) => permiso.roles)
  @JoinTable({
    name: 'roles_permisos',
    joinColumn: { name: 'id_rol', referencedColumnName: 'idRol' },
    inverseJoinColumn: { name: 'id_permiso', referencedColumnName: 'idPermiso' },
  })
  permisos: Permiso[];
}