import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { RefreshTokenService } from './refresh-token.service';
import { ClientesModule } from '../clientes/clientes.module';

@Module({
  imports: [UsuariosModule, ClientesModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshTokenService],
})
export class AuthModule {}
