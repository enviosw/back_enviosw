
import { Cliente } from '../../clientes/entities/cliente.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

@Entity('roles')
export class Rol {
  
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;
  
  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fecha_actualizacion: Date;

  @OneToMany(() => Cliente, (cliente) => cliente.rol)
  clientes: Cliente[]; // Relación con la entidad Cliente
  
}
