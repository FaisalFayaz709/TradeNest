import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { parseApiEnvironment } from '@tradenest/config';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/http/api-exception.filter.js';
import { requestIdMiddleware } from './common/http/request-id.js';
import { ObservabilityContextService, observabilityContextMiddleware } from './common/observability/index.js';

async function bootstrap(): Promise<void> {
  const environment = parseApiEnvironment(process.env);
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Defense-in-depth HTTP headers; no extra dependency or architecture change.
  app.use((_request: unknown, response: { removeHeader: (key: string) => void; setHeader: (key: string, value: string) => void }, next: () => void) => {
    response.removeHeader('X-Powered-By');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(requestIdMiddleware);
  app.use(observabilityContextMiddleware(app.get(ObservabilityContextService)));
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  // LOCKED blueprint requirement: REST + OpenAPI/Swagger exposed by NestJS.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('TradeNest API')
    .setDescription('TradeNest marketplace REST API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'TradeNest JWT access token',
      },
      'bearer',
    )
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, documentFactory, {
    jsonDocumentUrl: 'api/docs/openapi.json',
    yamlDocumentUrl: 'api/docs/openapi.yaml',
  });

  await app.listen(environment.API_PORT, environment.API_HOST);
}

void bootstrap();
