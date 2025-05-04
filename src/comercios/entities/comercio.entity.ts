import { Categoria } from 'src/categorias/entities/categoria.entity';
import { Producto } from '../../productos/entities/producto.entity';
import { Servicio } from '../../servicios/entities/servicio.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

@Entity('comercios')
export class Comercio {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  nombre_comercial: string;

  @Column({ length: 200 })
  razon_social: string;

  @Column({ length: 20 })
  nit: string;

  @Column({ length: 255 })
  descripcion: string;

  @Column({ length: 100 })
  responsable: string;

  @Column({ length: 100 })
  email_contacto: string;

  @Column({ length: 15 })
  telefono: string;

  @Column({ length: 15 })
  telefono_secundario: string;

  @Column({ length: 255 })
  direccion: string;

  @Column({ nullable: true })
  logo_url: string;

  @Column({ default: true })
  estado: string;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fecha_actualizacion: Date;

  // Relación con la entidad Servicio
  @ManyToOne(() => Servicio, (servicio) => servicio.comercios, { eager: true })
  @JoinColumn({ name: 'servicio_id' })
  servicio: Servicio;

  @OneToMany(() => Producto, (producto) => producto.comercio) // Relación con Producto
  productos: Producto[]; // Esta es la propiedad que permite acceder a los productos de un comercio

  @OneToMany(() => Categoria, (categoria) => categoria.comercio)
  categorias: Categoria[];
}
