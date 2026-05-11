import { Module } from '@nestjs/common';
import { RoomsGateway } from './rooms/rooms.gateway';

@Module({
  providers: [RoomsGateway]
})
export class RoomsModule {}
