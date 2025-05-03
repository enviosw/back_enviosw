// src/tipos-comercio/entities/tipo-comercio.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
// import { Comercio } from '../../comercios/entities/comercio.entity';

@Entity('tipos_comercio')
export class TipoComercio {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, unique: true })
  nombre: string;

  @Column({ length: 255 })
  descripcion: string;

  // @OneToMany(() => Comercio, comercio => comercio.tipo)
  // comercios: Comercio[];
}
