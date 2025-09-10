import { Module } from '@nestjs/common';
import { UsuariosModule } from './usuarios/usuarios.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ComerciosModule } from './comercios/comercios.module';
import { RolesModule } from './roles/roles.module';
import { FileUploadModule } from './common/file-upload.module';
import { ServiciosModule } from './servicios/servicios.module';
import { CategoriasModule } from './categorias/categorias.module';
import { ProductosModule } from './productos/productos.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ClientesModule } from './clientes/clientes.module';
import { ImagenesModule } from './imagenes/imagenes.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { DomiliariosModule } from './domiliarios/domiliarios.module';
import { DomiciliosModule } from './domicilios/domicilios.module';
import { ShortlinksModule } from './shortlinks/shortlinks.module';
import { ComerciosQrModule } from './shortlinks/comercios-qr.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

       // 👉 Pasa múltiples opciones como argumentos separados, no como array
    ServeStaticModule.forRoot(
      {
        rootPath: join(process.cwd(), 'uploads'),
        serveRoot: '/api/uploads',
      },
      {
        rootPath: join(process.cwd(), 'public'),
        serveRoot: '/api/public',
        serveStaticOptions: { maxAge: '1d' },
      },
    ),

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
        synchronize: false,
      }),
    }),

    UsuariosModule,

    AuthModule,

    ComerciosModule,

    ClientesModule,

    RolesModule,

    FileUploadModule,

    ServiciosModule,

    CategoriasModule,

    ProductosModule,

    ImagenesModule,

    WhatsappModule,

    ChatbotModule,

    DomiliariosModule,

    DomiciliosModule,

    ShortlinksModule,
    
    ComerciosQrModule,
  ],
})
export class AppModule { }
