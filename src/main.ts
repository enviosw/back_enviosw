import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api'); // 👈 esto es lo que necesitas
  //Comentario

  app.enableCors({
    origin: '*', // Permite cualquier origen
    methods: '*', // Permite todos los métodos: GET, POST, PUT, DELETE, etc.
    allowedHeaders: '*', // Permite todos los headers
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // ✔️ elimina propiedades no definidas en el DTO
      forbidNonWhitelisted: false, // ❌ NO lanza error si vienen extras
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
