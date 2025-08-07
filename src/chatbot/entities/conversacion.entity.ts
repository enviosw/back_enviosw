import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('conversaciones')
export class Conversacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  numero_cliente: string;

  @Column()
  numero_domiciliario: string;

  @CreateDateColumn()
  fecha_inicio: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_fin: Date;

  @Column({ default: 'activa' }) // 'activa' | 'finalizada'
  estado: string;
}
