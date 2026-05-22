import { Module } from '@nestjs/common';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';
import { ChallengesModule } from 'src/challenges/challenges.module';

@Module({
  imports: [ChallengesModule],
  providers: [RoomsService, RoomsGateway],
  exports: [RoomsService],
})
export class RoomsModule {}
