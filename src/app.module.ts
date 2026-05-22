import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RoomsModule } from './rooms/rooms.module';
import { ConfigModule } from '@nestjs/config';
import { ChallengesModule } from './challenges/challenges.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), RoomsModule, ChallengesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
