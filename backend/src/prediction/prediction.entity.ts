import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { MlModel } from './ml-model.entity';

@Entity('predictions')
export class Prediction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 7, name: 'year_month' })
  year_month: string;

  @Column({ type: 'varchar', length: 20 })
  grade: string;

  @Column({ type: 'enum', enum: ['High', 'Medium', 'Low'] })
  elevation: 'High' | 'Medium' | 'Low';

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  predicted_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true, default: null })
  price_lower_bound: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true, default: null })
  price_upper_bound: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, default: null })
  confidence: number | null;

  @Column({ type: 'enum', enum: ['LOW', 'MEDIUM', 'HIGH'] })
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';

  @ManyToOne(() => MlModel)
  @JoinColumn({ name: 'model_id' })
  model: MlModel;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true, default: null })
  actual_price: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
