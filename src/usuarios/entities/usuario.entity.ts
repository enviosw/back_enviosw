import { Comercio } from '../../comercios/entities/comercio.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'nombre', length: 100 })
  nombre: string;

  @Column({ name: 'email', unique: true })
  email: string;

  @Column({ name: 'password', select: false })
  password: string;

  @Column({ name: 'rol', default: 'usuario' })
  rol: string;

  @Column({ name: 'estado', default: 'activo' })
  estado: string;

  @Column({ name: 'telefono', nullable: true, length: 15 })
  telefono: string;

  @Column({ name: 'direccion', nullable: true, length: 255 })
  direccion: string;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fecha_actualizacion: Date;

  @ManyToOne(() => Comercio, (comercio) => comercio.usuarios, { nullable: true })
  @JoinColumn({ name: 'comercio_id' })
  comercio: Comercio;
}
