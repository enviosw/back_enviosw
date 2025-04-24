import {
    BadRequestException,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import { RegisterDto } from "./dto/registrar-usuario.dto";

import { JwtService } from "@nestjs/jwt";
import * as bcryptjs from "bcryptjs";
import { LoginDto } from "./dto/login.dto";
import { UsuariosService } from "src/usuarios/usuarios.service";

@Injectable()
export class AuthService {
    constructor(private readonly usersService: UsuariosService) { }

    async register({ password, email, nombre }: RegisterDto) {
        const user = await this.usersService.findOneByEmail(email);

        if (user) {
            throw new BadRequestException("Email already exists");
        }

        const hashedPassword = await bcryptjs.hash(password, 10);

        await this.usersService.create({
            nombre,
            email,
            password: hashedPassword,
        });

        return {
            message: "User created successfully",
        };
    }

    async login({ email, password }: LoginDto) {
        const user = await this.usersService.findOneByEmail(email);

        if (!user) {
            throw new UnauthorizedException("Invalid email");
        }

        const isPasswordValid = await bcryptjs.compare(password, user.password);

        if (!isPasswordValid) {
            throw new UnauthorizedException("Invalid password");
        }

        return {
            email: user.email,
        };
    }
}