import { Module } from '@nestjs/common';
import { UsuariosModule } from './usuarios/usuarios.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ComerciosModule } from './comercios/comercios.module';
import { TiposComerciosModule } from './tipos_comercios/tipos_comercios.module';
import { RolesModule } from './roles/roles.module';
import { FileUploadModule } from './common/file-upload.module';
import { ServiciosModule } from './servicios/servicios.module';
import { CategoriasModule } from './categorias/categorias.module';
import { ProductosModule } from './productos/productos.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ClientesModule } from './clientes/clientes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'uploads'), // acceso físico
      serveRoot: '/', // acceso público desde la URL
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),

    UsuariosModule,

    AuthModule,

    ComerciosModule,

    TiposComerciosModule,

    ClientesModule,

    RolesModule,

    FileUploadModule,

    ServiciosModule,

    CategoriasModule,

    ProductosModule,
  ],
})
export class AppModule { }
