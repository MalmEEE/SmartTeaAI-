import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ml_models')
export class MlModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: ['ARIMA', 'RANDOM_FOREST', 'XGBOOST', 'LSTM'] })
  model_name: 'ARIMA' | 'RANDOM_FOREST' | 'XGBOOST' | 'LSTM';

  @Column({ type: 'varchar', length: 20 })
  version: string;

  @Column({ type: 'varchar', length: 255 })
  file_path: string;

  @Column({ type: 'json', nullable: true, default: null })
  hyperparameters: object | null;

  @Column({ type: 'boolean', default: false })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  trained_at: Date;
}
