import { Rol } from "../../roles/entities/role.entity";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('clientes')
export class Cliente {

    @PrimaryGeneratedColumn()
    id: number;

    @Column("varchar", { length: 150 })
    name: string;

    @Column("varchar", { length: 150 })
    lastName: string;

    @Column("varchar", { length: 255, unique: true })
    email: string;

    @Column("varchar", { length: 255 })
    password: string;

    @Column("varchar", { length: 20 })
    phone: string;

    @Column("varchar", { length: 20, nullable: true  })
    phone_2: string;
    
    @Column("varchar", { length: 255 })
    address: string;

    @Column("varchar", { length: 20 })
    status: string;

    @CreateDateColumn({ name: 'fecha_creacion' })
    fecha_creacion: Date;
    
    @UpdateDateColumn({ name: 'fecha_actualizacion' })
    fecha_actualizacion: Date;

    @ManyToOne(() => Rol, (rol) => rol.clientes, {nullable: false} )
    @JoinColumn({ name: 'rol_id'})
    rol: Rol;

    @Column()
    rol_id: number;
}
