import { Injectable } from '@nestjs/common';

export type OperationalLogLevel = 'info' | 'warn' | 'error';
export type OperationalLogFields = Record<string, string | number | boolean | null | undefined>;

const SERVICE = 'tradenest-api';

@Injectable()
export class OperationalLoggerService {
  info(event: string, fields: OperationalLogFields = {}): void {
    this.write('info', event, fields);
  }

  warn(event: string, fields: OperationalLogFields = {}): void {
    this.write('warn', event, fields);
  }

  error(event: string, fields: OperationalLogFields = {}, error?: unknown): void {
    const errorType = error instanceof Error ? error.name : error === undefined ? undefined : typeof error;
    this.write('error', event, {
      ...fields,
      errorType,
    });
  }

  private write(level: OperationalLogLevel, event: string, fields: OperationalLogFields): void {
    const record: Record<string, string | number | boolean | null> = {
      timestamp: new Date().toISOString(),
      level,
      service: SERVICE,
      event,
    };

    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      record[key] = value;
    }

    const line = `${JSON.stringify(record)}\n`;
    if (level === 'error') process.stderr.write(line);
    else process.stdout.write(line);
  }
}
