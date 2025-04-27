import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('usuarios')
export class Usuario {
    @PrimaryGeneratedColumn({ name: 'id' })
    id: number;

    @Column({ name: 'nombre', length: 100 })
    nombre: string;

    @Column({ name: 'email', unique: true })
    email: string;

    @Column({ name: 'password' })
    password: string;

    @Column({ name: 'rol', default: 'usuario' })
    rol: string;

    @Column({ name: 'estado', default: true })
    estado: string;

    @CreateDateColumn({ name: 'fecha_creacion' })
    fecha_creacion: Date;

    @UpdateDateColumn({ name: 'fecha_actualizacion' })
    fecha_actualizacion: Date;
}
