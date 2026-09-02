import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminFaqController, FaqController } from "./faq.controller";
import { FaqService } from "./faq.service";
import { Faq } from "./entities/faq.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Faq])],
  controllers: [FaqController, AdminFaqController],
  providers: [FaqService],
})
export class FaqModule {}
