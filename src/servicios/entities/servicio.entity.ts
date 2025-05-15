import { Comercio } from '../../comercios/entities/comercio.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('servicios')
export class Servicio {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  nombre: string;

  @Column({ default: 'activo' })
  estado: string; // true: activo, false: inactivo

  @Column({ length: 50, nullable: true })
  icon: string;

  @Column({ length: 20, nullable: true })
  color: string;

  // NUEVAS COLUMNAS AÑADIDAS:
  @Column({ type: 'int', nullable: true })
  orden: number;

  @Column({ length: 255, nullable: true })
  foto: string;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fecha_actualizacion: Date;

  // Relación inversa con Comercio
  @OneToMany(() => Comercio, (comercio) => comercio.servicio)
  comercios: Comercio[];
}
