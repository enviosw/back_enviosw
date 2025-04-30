import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { RegisterDto } from './dto/registrar-usuario.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenService } from './refresh-token.service';
import { jwtConstants } from './constants/jwt.constant';

@Injectable()
export class AuthService {
    constructor(
        private readonly usuariosService: UsuariosService,
        private readonly jwtService: JwtService,
        private readonly refreshTokenService: RefreshTokenService
    ) { }


    async register(registerDto: RegisterDto) {
        const { email, password, nombre, rol } = registerDto;

        const userExists = await this.usuariosService.findOneByEmail(email);
        if (userExists) {
            throw new BadRequestException('El correo ya está registrado.');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await this.usuariosService.create({
            nombre,
            email,
            password: hashedPassword,
            rol: 'cliente',
        });

        // Elimina el campo password si lo contiene
        const { password: _, ...userWithoutPassword } = user;

        return {
            message: 'Usuario creado con éxito',
            user: userWithoutPassword,
        };
    }


    async login({ email, password }: LoginDto) {
        const user = await this.usuariosService.findOneByEmail(email);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw new UnauthorizedException('Credenciales inválidas');
        }

        const payload = { sub: user.id, email: user.email, rol: user.rol };

        const access_token = await this.jwtService.signAsync(payload, {
            secret: jwtConstants.accessTokenSecret,
            expiresIn: jwtConstants.accessTokenExpiration,
        });

        const refresh_token = await this.jwtService.signAsync(payload, {
            secret: jwtConstants.refreshTokenSecret,
            expiresIn: jwtConstants.refreshTokenExpiration,
        });

        await this.refreshTokenService.save(user.id, refresh_token);

        return {
            access_token,
            refresh_token,
            user: {
                id: user.id,
                email: user.email,
                nombre: user.nombre,
                rol: user.rol,
            },
        };
    }

    async refresh(userId: number, refreshToken: string) {
        const isValid = await this.refreshTokenService.verify(userId, refreshToken);
        if (!isValid) throw new ForbiddenException('Token inválido o expirado');

        const user = await this.usuariosService.findOne(userId);

        const payload = {
            sub: user.id,
            email: user.email,
            rol: user.rol,
        };

        const newAccessToken = await this.jwtService.signAsync(payload, {
            secret: jwtConstants.accessTokenSecret,
            expiresIn: jwtConstants.accessTokenExpiration,
        });

        return {
            access_token: newAccessToken,
        };
    }

    async logout(userId: number) {
        await this.refreshTokenService.remove(userId);
        return { message: 'Tokens eliminados con éxito' };
    }
}