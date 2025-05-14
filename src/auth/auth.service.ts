import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsuariosService } from '../usuarios/usuarios.service';
import { RegisterDto } from './dto/registrar-usuario.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenService } from './refresh-token.service';
import { jwtConstants } from './constants/jwt.constant';
import { ClientesService } from '../clientes/clientes.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly clientesService: ClientesService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
  ) { }

  async register(registerDto: RegisterDto) {
    try {
      const { email, password, rol, nombre } = registerDto;
      console.log(registerDto);

      const userExists = await this.usuariosService.findOneByEmail(email);
      if (userExists) {
        throw new BadRequestException('El correo ya está registrado.');
      }

      const clienteExists = await this.clientesService.findOneByEmail(email);
      if (clienteExists) {
        throw new BadRequestException('El correo ya está registrado.');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = (rol.toLocaleLowerCase() !== 'cliente')
        ? await this.usuariosService.create({
          nombre,
          email,
          password: hashedPassword,
          rol: 'aliado',
        })
        : await this.clientesService.create({
          name: registerDto.nombre,
          lastName: registerDto.apellido || '',
          address: registerDto.direccion || '',
          phone: registerDto.telefono || '',
          phone_2: registerDto.telefono2 || '',
          status: 'activo',
          email,
          password: hashedPassword,
          rol_id: 3,
        });

      console.log('user created', user);

      const { password: _, ...userWithoutPassword } = user;

      return {
        message: 'Usuario creado con éxito',
        user: userWithoutPassword,
      };
    } catch (error) {
      console.error('Error en registro:', error);
      // Re-lanza si ya es una excepción de NestJS
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Lanza una excepción genérica si no se reconoció
      throw new Error('Error al registrar el usuario');
    }
  }


  async login({ email, password }: LoginDto) {

    const user = await this.usuariosService.findOneByEmail(email);
console.log(user)

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }


    const comercioId = user.comercio?.id ?? null


    // Incluye el campo nombre en el payload
    const payload = { sub: user.id, email: user.email, rol: user.rol, nombre: user.nombre };

    // Generación de los tokens con el nuevo payload
    const access_token = await this.jwtService.signAsync(payload, {
      secret: jwtConstants.accessTokenSecret,
      expiresIn: jwtConstants.accessTokenExpiration,
    });

    const refresh_token = await this.jwtService.signAsync(payload, {
      secret: jwtConstants.refreshTokenSecret,
      expiresIn: jwtConstants.refreshTokenExpiration,
    });

    // Guarda el refresh token
    await this.refreshTokenService.save(user.id, refresh_token);

    // Devuelve la respuesta con el token y los datos del usuario, incluyendo el nombre
    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre, // Asegúrate de incluir 'nombre'
        rol: user.rol,
      },
      comercio: comercioId
    };
  }


  async refresh(userId: number, refreshToken: string) {
    const isValid = await this.refreshTokenService.verify(userId, refreshToken);
    if (!isValid) throw new ForbiddenException('Token inválido o expirado');

    const user = await this.usuariosService.findOne(userId);

    // Genera el nuevo payload incluyendo 'nombre'
    const payload = {
      sub: user.id,
      email: user.email,
      rol: user.rol,
      nombre: user.nombre, // Asegúrate de incluir 'nombre' aquí también
    };

    const newAccessToken = await this.jwtService.signAsync(payload, {
      secret: jwtConstants.accessTokenSecret,
      expiresIn: jwtConstants.accessTokenExpiration,
    });

    // Devuelve el nuevo token de acceso
    return {
      access_token: newAccessToken,
    };
  }


  async logout(userId: number) {
    await this.refreshTokenService.remove(userId);
    return { message: 'Tokens eliminados con éxito' };
  }
}
