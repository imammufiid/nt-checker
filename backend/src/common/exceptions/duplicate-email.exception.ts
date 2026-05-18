import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class DuplicateEmailException extends DomainException {
  constructor(message = 'Email already registered') {
    super('DUPLICATE_EMAIL', message, HttpStatus.CONFLICT);
  }
}
