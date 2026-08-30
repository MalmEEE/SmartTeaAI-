import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataPipelineModule } from './data-pipeline/data-pipeline.module';
import { PredictionModule } from './prediction/prediction.module';
import { HistoryModule } from './history/history.module';
import { ExplainabilityModule } from './explainability/explainability.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { User } from './users/user.entity';
import { RoleRequest } from './users/role-request.entity';
import { MlModel } from './prediction/ml-model.entity';
import { Prediction } from './prediction/prediction.entity';
import { Recommendation } from './prediction/recommendation.entity';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    // MySQL — requires the tables from backend/sql/smartteaai_auth.sql to exist.
    TypeOrmModule.forRootAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get('MYSQL_URL') || config.get('DATABASE_URL');
        if (url) {
          return {
            type: 'mysql',
            url,
            entities: [User, RoleRequest, MlModel, Prediction, Recommendation],
            synchronize: true,
          };
        }
        return {
          type:        'mysql',
          host:        config.get('DB_HOST', 'localhost'),
          port:        config.get<number>('DB_PORT', 3306),
          username:    config.get('DB_USER'),
          password:    config.get('DB_PASS'),
          database:    config.get('DB_NAME'),
          entities:    [User, RoleRequest, MlModel, Prediction, Recommendation],
          synchronize: true,
        };
      },
    }),

    UsersModule,
    AuthModule,
    AdminModule,
    DataPipelineModule,
    PredictionModule,
    HistoryModule,
    ExplainabilityModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers:   [AppService],
})
export class AppModule {}
