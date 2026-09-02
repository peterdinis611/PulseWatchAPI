import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoggerService } from '../logger/logger.service';
import { PublicUser } from '../user/public-user';
import { UserService } from '../user/user.service';
import { AuthPayload } from './auth.payload.model';
import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';
import { JwtPayload } from './jwt-payload';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    private readonly logger: LoggerService,
  ) {}

  async register(input: RegisterInput): Promise<AuthPayload> {
    const email = this.normalizeEmail(input.email);
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.users.create({
      email,
      passwordHash,
      name: input.name?.trim() || undefined,
    });

    this.logger.log(`Registered user ${user.email}`, AuthService.name);
    return this.issue(user);
  }

  async login(input: LoginInput): Promise<AuthPayload> {
    const email = this.normalizeEmail(input.email);
    const user = await this.users.findByEmail(email);

    if (!user) {
      this.logger.warn(`Login failed for unknown email`, AuthService.name);
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(input.password, user.passwordHash);
    if (!matches) {
      this.logger.warn(`Login failed for ${email}`, AuthService.name);
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issue({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    });
  }

  private issue(user: PublicUser): AuthPayload {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwt.sign(payload),
      user,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
