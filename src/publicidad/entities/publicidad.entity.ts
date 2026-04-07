import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity('publicidad')
export class Publicidad {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 500 })
  imagen: string;

  @Column({ type: 'text' })
  ruta: string;

  @Column({ default: 1 })
  estado: number;

  // Orden para mostrar en el slider
  @Column({ type: 'int', default: 1 })
  orden: number;

  // Fecha desde cuándo mostrar
  @Column({ name: 'fecha_inicio', type: 'timestamptz', nullable: true })
  fecha_inicio: Date | null;

  // Fecha hasta cuándo mostrar
  @Column({ name: 'fecha_fin', type: 'timestamptz', nullable: true })
  fecha_fin: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
