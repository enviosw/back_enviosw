// src/shortlinks/shortlink.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';

@Entity('shortlinks')
@Unique(['commerceId'])
export class ShortLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // slug estable, p.ej. "comercio-39"
  @Index({ unique: true })
  @Column({ length: 120 })
  slug: string;

  // id del comercio al que pertenece
  @Column({ type: 'int' })
  commerceId: number;

  // la URL real de destino (redirigimos aquí si está activo)
  @Column('text')
  targetUrl: string;

  // para invalidar/activar rápido
  @Column({ type: 'boolean', default: true })
  active: boolean;

  // expiración opcional
  @Column({ type: 'timestamptz', nullable: true })
  validFrom?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  validTo?: Date | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updatedAt: Date;
}
