// src/categories/entities/category.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Producto } from '../../productos/entities/producto.entity';
import { Comercio } from '../../comercios/entities/comercio.entity';

@Entity('categorias')
export class Categoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  // Relación con Producto
  @OneToMany(() => Producto, (producto) => producto.categoria, { onDelete: 'SET NULL' })
  productos: Producto[];

  @ManyToOne(() => Comercio, (comercio) => comercio.categorias)
  @JoinColumn({ name: 'comercio_id' })
  comercio: Comercio;
}
