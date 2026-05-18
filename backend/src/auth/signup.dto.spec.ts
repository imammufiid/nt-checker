import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SignupDto } from './dto/signup.dto';

function validate(input: Record<string, unknown>) {
  const dto = plainToInstance(SignupDto, input);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors };
}

describe('SignupDto', () => {
  it('accepts a valid signup payload', () => {
    const { errors } = validate({
      email: 'andi@example.com',
      password: 'secret123',
      name: 'Andi',
    });
    expect(errors).toEqual([]);
  });

  it('lower-cases the email during transform', () => {
    const { dto, errors } = validate({
      email: '  ANDI@EXAMPLE.COM  ',
      password: 'secret123',
    });
    expect(errors).toEqual([]);
    expect(dto.email).toBe('andi@example.com');
  });

  it('rejects passwords shorter than 8 characters', () => {
    const { errors } = validate({
      email: 'andi@example.com',
      password: 'short',
    });
    expect(errors.length).toBeGreaterThan(0);
    const flat = errors.flatMap((e) => Object.keys(e.constraints ?? {}));
    expect(flat).toContain('minLength');
  });

  it('accepts a password of exactly 8 characters', () => {
    const { errors } = validate({
      email: 'andi@example.com',
      password: '12345678',
    });
    expect(errors).toEqual([]);
  });

  it('rejects malformed emails', () => {
    const { errors } = validate({
      email: 'not-an-email',
      password: 'secret123',
    });
    expect(errors.length).toBeGreaterThan(0);
    const flat = errors.flatMap((e) => Object.keys(e.constraints ?? {}));
    expect(flat).toContain('isEmail');
  });

  it('accepts a missing name (name is optional)', () => {
    const { dto, errors } = validate({
      email: 'andi@example.com',
      password: 'secret123',
    });
    expect(errors).toEqual([]);
    expect(dto.name).toBeUndefined();
  });
});
