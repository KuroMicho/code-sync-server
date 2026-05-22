import { Module } from '@nestjs/common';
import { RoomsGateway } from './rooms/rooms.gateway';
import { RoomsService } from './rooms/rooms.service';

@Module({
  providers: [RoomsService, RoomsGateway],
  exports: [RoomsService],
})
export class RoomsModule {}
