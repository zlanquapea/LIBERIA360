import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SavedCollection } from "./collection.entity";
import { CollectionsController } from "./collections.controller";
import { CollectionsService } from "./collections.service";
@Module({
  imports: [TypeOrmModule.forFeature([SavedCollection])],
  controllers: [CollectionsController],
  providers: [CollectionsService],
})
export class CollectionsModule {}
