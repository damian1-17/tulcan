import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from '@/app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Response, Request } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Servir assets estáticos
  app.useStaticAssets(join(process.cwd(), 'src', 'assets'), {
    prefix: '/assets',
  });
  // Cookie Parser - IMPORTANTE
  app.use(cookieParser());

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS con credentials
  app.enableCors({
    origin: [
      'https://front-pedidos-vue.vercel.app',
      'http://localhost:3000',
      'http://localhost:4200',
      'http://localhost:5173',
      'https://front-pedidos-vue-zgyj.vercel.app',
      'https://frontpedidosvue.onrender.com'

    ],

    credentials: true, // ✅ IMPORTANTE: permite cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Set-Cookie'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  });

  // Prefijo global
  app.setGlobalPrefix('api/v1');

  app.getHttpAdapter().getInstance().get('/', (_req: Request, res: Response) => {
    res.send('API 123');
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Dashboard API')
    .setDescription('API del Módulo de Dashboard')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);

  console.log(`Aplicación corriendo en: http://localhost:${port}`);
  console.log(`Documentación Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();