import { Comercio } from "src/comercios/entities/comercio.entity";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";

@Entity('zonas')
export class Zona {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100 })
    nombre: string;


    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    fecha_creacion: Date;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    fecha_actualizacion: Date;

    // 👇 esta propiedad faltaba
    @OneToMany(() => Comercio, (comercio) => comercio.zona)
    comercios: Comercio[];

}
