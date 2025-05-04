// src/productos/entities/producto.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Categoria } from '../../categorias/entities/categoria.entity';
import { Comercio } from '../../comercios/entities/comercio.entity';

@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column()
  descripcion: string;

  @ManyToOne(() => Categoria, (categoria) => categoria.productos)
  categoria: Categoria;

  @ManyToOne(() => Comercio, (comercio) => comercio.productos) // Relación con Comercio
  comercio: Comercio; // Esta es la propiedad que establece la relación con comercio

  @Column('decimal')
  precio: number;

  @Column('decimal', { nullable: true })
  precio_descuento: number;

  @Column({ default: 'activo' })
  estado: string;

  @Column({ default: 'inactivo' })
  estado_descuento: string;

  @Column()
  unidad: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_creacion: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_actualizacion: Date;
}
