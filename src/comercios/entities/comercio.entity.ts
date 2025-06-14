import { Categoria } from '../../categorias/entities/categoria.entity';
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
  ManyToMany,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';

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

  @Column({ default: 'activo' })
  estado: string;


  @Column({ type: 'int', default: 0 })
  activar_numero: number; // 0 = inactivo, 1 = activo

  // Nueva columna para horarios (almacena datos JSON)

  @Column('jsonb', {
    nullable: true,
    default: {
      horarios: [
        { dia: 'lunes', apertura: '07:00 AM', cierre: '04:30 PM' },
        { dia: 'martes', apertura: '07:00 AM', cierre: '04:30 PM' },
        { dia: 'miercoles', apertura: '07:00 AM', cierre: '04:30 PM' },
        { dia: 'jueves', apertura: '07:00 AM', cierre: '04:30 PM' },
        { dia: 'viernes', apertura: '07:00 AM', cierre: '04:30 PM' },
        { dia: 'sabado', apertura: '07:00 AM', cierre: '04:30 PM' },
        { dia: 'domingo', apertura: '07:00 AM', cierre: '11:30 PM' }
      ]
    }
  })
  horarios: {
    horarios: {
      dia: string;
      apertura: string;
      cierre: string;
    }[];
  };

  // Columna para el estado del comercio (abierto o cerrado)
  @Column({ type: 'boolean', default: true })
  estado_comercio: boolean; // true = abierto, false = cerrado

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

  // Relación Muchos a Muchos con Usuario
  @OneToMany(() => Usuario, (usuario) => usuario.comercio)
  usuarios: Usuario[];
}
