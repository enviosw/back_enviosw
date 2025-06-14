import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtConstants } from './constants/jwt.constant';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.accessTokenSecret,
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.rol, // <-- aquí mapeas "rol" del token a "role" esperado por el guardia
      nombre: payload.nombre,
    };
  }
}
