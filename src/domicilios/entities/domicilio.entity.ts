import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn,
  UpdateDateColumn, JoinColumn, Index
} from 'typeorm';
import { Domiciliario } from '../../domiliarios/entities/domiliario.entity';

export enum DomicilioEstado {
  PENDIENTE = 0,
  ASIGNADO = 1,
  CANCELADO_TIMEOUT = -1,
  PROCESO = 3,
  // agrega otros estados si los tienes
}

@Entity('domicilios')
@Index(['estado', 'fecha_creacion'])
export class Domicilio {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true })
  mensaje_confirmacion: string;

  // 🔁 Usa enum o al menos alinea el default con tu cron
  @Column({ type: 'int', default: DomicilioEstado.PENDIENTE })
  estado: number;

  // Si esta "fecha/hora" es la programada del servicio, mantenla; para el timeout usa fecha_creacion
  @Column({ type: 'timestamp', nullable: true })
  fecha: Date;

  @Column({ type: 'varchar', length: 5, nullable: true })
  hora: string;

  @Column({ type: 'varchar', length: 20 })
  numero_cliente: string;

  @ManyToOne(() => Domiciliario, { nullable: true })
  @JoinColumn({ name: 'id_domiciliario' })
  domiciliario: Domiciliario;

  // ✅ después
  @Column({ name: 'id_cliente', type: 'int', nullable: true })
  id_cliente: number | null;


  @Column({ length: 30 })
  tipo_servicio: string;

  @Column({ type: 'varchar', length: 255 })
  origen_direccion: string;

  @Column({ type: 'varchar', length: 255 })
  destino_direccion: string;

  @Column({ length: 20, nullable: true })
  telefono_contacto_origen: string;

  @Column({ length: 20, nullable: true })
  telefono_contacto_destino: string;

  @Column({ type: 'text', nullable: true })
  notas: string;

  @Column({ type: 'text', nullable: true })
  detalles_pedido: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  foto_entrega_url: string;

  // ⏱️ Úsala para medir los 8 minutos
  @CreateDateColumn()
  fecha_creacion: Date;

  @UpdateDateColumn()
  fecha_actualizacion: Date;

  // ✅ Nuevo: fecha en que se asignó
  @Column({ type: 'timestamp', nullable: true })
  fecha_asignacion: Date | null;

  // ✅ Nuevo: info de cancelación
  @Column({ type: 'timestamp', nullable: true })
  fecha_cancelacion: Date | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  motivo_cancelacion: string | null;
}
