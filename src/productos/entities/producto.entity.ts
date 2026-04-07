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

  @Column({ nullable: true })
  descripcion: string;

  @ManyToOne(() => Categoria, (categoria) => categoria.productos, {
    onDelete: 'CASCADE',
  })
  categoria: Categoria;


  @ManyToOne(() => Comercio, (comercio) => comercio.productos, {
    onDelete: 'CASCADE',
  })
  comercio: Comercio;


  @Column('decimal')
  precio: number;

  @Column('decimal', { nullable: true })
  precio_descuento: number;

  @Column({ default: 'activo' })
  estado: string;

  @Column({ default: 'inactivo' })
  estado_descuento: string;

  @Column({ nullable: true })
  unidad: string;

  @Column({ nullable: true })
  imagen_url: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_creacion: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_actualizacion: Date;
}
