import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',          // Permite cualquier origen
    methods: '*',         // Permite todos los métodos: GET, POST, PUT, DELETE, etc.
    allowedHeaders: '*',  // Permite todos los headers
  });
  app.useGlobalPipes(new ValidationPipe());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
