import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
} from 'typeorm';
import { Domiciliario } from 'src/domiliarios/entities/domiliario.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';

@Entity('domicilios')
export class Domicilio {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'text', nullable: true })
    mensaje_confirmacion: string;

    @Column({ type: 'int', default: 1 })
    estado: number; // 1 = pendiente, etc.

    @Column({ type: 'timestamp', nullable: true })
    fecha: Date;

    @Column({ type: 'varchar', length: 5, nullable: true })
    hora: string;

    @Column({ type: 'varchar', length: 20 })
    numero_cliente: string;

    // 🔗 Relación con domiciliario
    @ManyToOne(() => Domiciliario, { nullable: true })
    @JoinColumn({ name: 'id_domiciliario' })
    domiciliario: Domiciliario;

    // 🔗 Relación con cliente
    @ManyToOne(() => Cliente, { nullable: true })
    @JoinColumn({ name: 'id_cliente' })
    cliente: Cliente;


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


    @CreateDateColumn()
    fecha_creacion: Date;

    @UpdateDateColumn()
    fecha_actualizacion: Date;
}
