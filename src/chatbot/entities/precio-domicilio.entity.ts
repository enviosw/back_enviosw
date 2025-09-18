import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'precios_domicilios' })
export class PrecioDomicilio {
  @PrimaryGeneratedColumn()
  id!: number;

  // número de WhatsApp del domiciliario (normalizado, ej: 57XXXXXXXXXX)
  @Index()
  @Column({ type: 'varchar', length: 20 })
  numero_domiciliario!: string;

  // costo total del servicio
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  costo!: string; // usa string para no tener problemas de precisión con decimal

  // fecha de registro (auto)
  @CreateDateColumn({ type: 'timestamp with time zone' })
  fecha!: Date;
}
