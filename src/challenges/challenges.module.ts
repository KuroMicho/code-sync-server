import { Module } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { ChallengeEvaluatorService } from './challenge-evaluator.service';

@Module({
  providers: [ChallengesService, ChallengeEvaluatorService],
  exports: [ChallengesService, ChallengeEvaluatorService],
})
export class ChallengesModule {}
