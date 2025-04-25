import { TipoComercio } from 'src/tipos_comercios/entities/tipos_comercio.entity';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('comercios')
export class Comercio {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 150 })
    nombre_comercial: string;

    @Column({ length: 200 })
    razon_social: string;

    @Column({ length: 20, unique: true })
    nit: string;

    @Column({ length: 255 })
    descripcion: string;

    @Column({ length: 100 })
    categoria: string;

    @Column({ length: 100 })
    responsable: string;

    @Column({ length: 100, unique: true })
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
    activo: boolean;

    @CreateDateColumn({ name: 'fecha_creacion' })
    fecha_creacion: Date;

    @UpdateDateColumn({ name: 'fecha_actualizacion' })
    fecha_actualizacion: Date;

    @ManyToOne(() => TipoComercio, tipo => tipo.comercios, { eager: true })
    @JoinColumn({ name: 'tipo_id' })
    tipo: TipoComercio;
}
