import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Prediction } from './prediction.entity';

@Entity('recommendations')
export class Recommendation {
  @PrimaryGeneratedColumn()
  id?: number;

  @ManyToOne(() => Prediction)
  @JoinColumn({ name: 'prediction_id' })
  prediction?: Prediction;

  @Column({ type: 'enum', enum: ['SELL', 'HOLD', 'MONITOR'] })
  action?: 'SELL' | 'HOLD' | 'MONITOR';

  @Column({ type: 'text', nullable: true, default: null })
  justification?: string | null;

  @Column({
    type: 'enum',
    enum: ['FARMER', 'BROKER', 'EXPORTER', 'BUYER', 'ANALYST', 'ALL'],
    default: 'ALL',
  })
  target_role?: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at?: Date;
}
