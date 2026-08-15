import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Creator } from "./entities/creator.entity";
import { CreatorsService } from "./creators.service";
import { CreatorsController } from "./creators.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Creator])],
  controllers: [CreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}
