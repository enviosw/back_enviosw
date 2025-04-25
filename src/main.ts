import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',          // Permite cualquier origen
    methods: '*',         // Permite todos los métodos: GET, POST, PUT, DELETE, etc.
    allowedHeaders: '*',  // Permite todos los headers
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
