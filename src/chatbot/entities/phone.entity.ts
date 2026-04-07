import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('phones')
export class Phone {
  @PrimaryGeneratedColumn()
  id: number;


  @Index({ unique: true })
  @Column()
  key: string;

  @Index({ unique: true })
  @Column()
  value: string;

  @CreateDateColumn()
  createdAt: Date;
}
