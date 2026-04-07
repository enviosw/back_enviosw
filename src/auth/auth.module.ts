import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { RefreshTokenService } from './refresh-token.service';
import { ClientesModule } from '../clientes/clientes.module';
import { AuthGuard } from './auth.guard';
import { jwtConstants } from './constants/jwt.constant';

@Module({
  imports: [
    forwardRef(() => UsuariosModule),
    forwardRef(() => ClientesModule),
    JwtModule.register({
      secret: jwtConstants.accessTokenSecret,
      signOptions: {
        expiresIn: jwtConstants.accessTokenExpiration, // ✅ FIX
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshTokenService, AuthGuard],
  exports: [AuthService, AuthGuard, JwtModule],
})
export class AuthModule {}