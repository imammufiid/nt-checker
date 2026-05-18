import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LoginDto } from './dto/login.dto';

function validate(input: Record<string, unknown>) {
  const dto = plainToInstance(LoginDto, input);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors };
}

describe('LoginDto', () => {
  it('accepts a valid login payload', () => {
    const { errors } = validate({
      email: 'andi@example.com',
      password: 'whatever',
    });
    expect(errors).toEqual([]);
  });

  it('lower-cases email during transform', () => {
    const { dto } = validate({
      email: 'Andi@Example.COM',
      password: 'whatever',
    });
    expect(dto.email).toBe('andi@example.com');
  });

  it('rejects missing email', () => {
    const { errors } = validate({ password: 'whatever' });
    expect(errors.length).toBeGreaterThan(0);
    const props = errors.map((e) => e.property);
    expect(props).toContain('email');
  });

  it('rejects missing password', () => {
    const { errors } = validate({ email: 'andi@example.com' });
    expect(errors.length).toBeGreaterThan(0);
    const props = errors.map((e) => e.property);
    expect(props).toContain('password');
  });

  it('rejects malformed email', () => {
    const { errors } = validate({ email: 'nope', password: 'whatever' });
    const flat = errors.flatMap((e) => Object.keys(e.constraints ?? {}));
    expect(flat).toContain('isEmail');
  });
});
