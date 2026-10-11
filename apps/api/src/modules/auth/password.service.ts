import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { parseApiEnvironment } from '@tradenest/config';

@Injectable()
export class PasswordService {
  private readonly rounds = parseApiEnvironment(process.env).BCRYPT_ROUNDS;

  hash(password: string): Promise<string> {
    return hash(password, this.rounds);
  }

  compare(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }
}
