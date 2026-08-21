import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BusinessContent } from "./entities/business-content.entity";
import { Business } from "../businesses/entities/business.entity";
import { BusinessContentService } from "./business-content.service";
import { BusinessContentController } from "./business-content.controller";

@Module({
  imports: [TypeOrmModule.forFeature([BusinessContent, Business])],
  controllers: [BusinessContentController],
  providers: [BusinessContentService],
  exports: [BusinessContentService],
})
export class BusinessContentModule {}
