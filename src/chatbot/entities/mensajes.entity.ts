import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Conversacion } from './conversacion.entity';

@Entity('mensajes')
export class Mensaje {
  @PrimaryGeneratedColumn('uuid')
  id: number;

  @Column()
  conversacion_id: string;

  @Column()
  emisor: string;

  @Column()
  receptor: string;

  @Column('text')
  contenido: string;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ default: 'text' }) // text, sticker, image, etc.
  tipo: string;
}
