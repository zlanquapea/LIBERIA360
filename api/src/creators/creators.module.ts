import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Creator } from "./entities/creator.entity";
import { CreatorPortfolioItem } from "./entities/creator-portfolio-item.entity";
import { CreatorOffering } from "./entities/creator-offering.entity";
import { CreatorsService } from "./creators.service";
import { CreatorsController } from "./creators.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([Creator, CreatorPortfolioItem, CreatorOffering]),
  ],
  controllers: [CreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}
