// domiciliario.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  Index
} from 'typeorm';


@Index(['estado', 'disponible', 'turno_orden']) // 👈 AÑADE ESTE INDEX
@Entity('domiciliarios')
export class Domiciliario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 100 })
  apellido: string;

  @Column({ length: 50 })
  alias: string;

  @Index('IDX_TELEFONO_WHATSAPP', ['telefono_whatsapp'], { unique: true })
  @Column({ length: 15 })
  telefono_whatsapp: string;

  @Column({ length: 15 })
  placa_moto: string;

  @Column({ type: 'int' })
  numero_chaqueta: number;

  @Column({ length: 255 })
  direccion_residencia: string;

  @Column({ default: true }) // activo o inactivo
  estado: boolean;

  @Column({ default: true }) // disponible o no
  disponible: boolean;

  @Column({ type: 'int', default: 1 }) // para el turno
  turno_orden: number;

  @CreateDateColumn()
  fecha_creacion: Date;

  @UpdateDateColumn()
  fecha_actualizacion: Date;


    // 👇 Campo simple (sin relación)
  @Column({ name: 'zona_id', type: 'int', nullable: true })
  zona_id: number | null;

}
