// welcome-image.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('welcome_image')
export class WelcomeImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string; // siempre será "WELCOME_IMAGE"

  @Column()
  path: string; // ejemplo: /uploads/12345.png
}
