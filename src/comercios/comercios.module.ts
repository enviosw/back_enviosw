import { forwardRef, Module } from '@nestjs/common';
import { ComerciosService } from './comercios.service';
import { ComerciosController } from './comercios.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comercio } from './entities/comercio.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Comercio]), forwardRef(() => AuthModule)],
  controllers: [ComerciosController],
  providers: [ComerciosService],
  exports: [ComerciosService], 
})
export class ComerciosModule {}
