/**
 * Tests for error handling
 */

import {
  MojenticError,
  GatewayError,
  ToolError,
  ValidationError,
  ParseError,
  TimeoutError,
  Ok,
  Err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  mapResult,
  mapError,
} from '../error';

describe('Error classes', () => {
  test('MojenticError should extend Error', () => {
    const error = new MojenticError('Test error');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MojenticError);
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('MojenticError');
  });

  test('GatewayError should include status code', () => {
    const error = new GatewayError('Connection failed', 500);
    expect(error).toBeInstanceOf(GatewayError);
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('GATEWAY_ERROR');
  });

  test('ToolError should include tool name', () => {
    const error = new ToolError('Tool failed', 'test_tool');
    expect(error).toBeInstanceOf(ToolError);
    expect(error.toolName).toBe('test_tool');
    expect(error.code).toBe('TOOL_ERROR');
  });

  test('ValidationError should include field', () => {
    const error = new ValidationError('Invalid value', 'email');
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.field).toBe('email');
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  test('ParseError should have correct code', () => {
    const error = new ParseError('Failed to parse JSON');
    expect(error).toBeInstanceOf(ParseError);
    expect(error.code).toBe('PARSE_ERROR');
  });

  test('TimeoutError should have default message', () => {
    const error = new TimeoutError();
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.message).toBe('Operation timed out');
    expect(error.code).toBe('TIMEOUT_ERROR');
  });
});

describe('Result type', () => {
  test('Ok should create successful result', () => {
    const result = Ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  test('Err should create error result', () => {
    const error = new Error('Test error');
    const result = Err(error);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(error);
    }
  });

  test('isOk should identify successful results', () => {
    const okResult = Ok(42);
    const errResult = Err(new Error('Test'));

    expect(isOk(okResult)).toBe(true);
    expect(isOk(errResult)).toBe(false);
  });

  test('isErr should identify error results', () => {
    const okResult = Ok(42);
    const errResult = Err(new Error('Test'));

    expect(isErr(okResult)).toBe(false);
    expect(isErr(errResult)).toBe(true);
  });

  test('unwrap should return value for Ok', () => {
    const result = Ok(42);
    expect(unwrap(result)).toBe(42);
  });

  test('unwrap should throw for Err', () => {
    const error = new Error('Test error');
    const result = Err(error);
    expect(() => unwrap(result)).toThrow(error);
  });

  test('unwrapOr should return value for Ok', () => {
    const result = Ok(42);
    expect(unwrapOr(result, 0)).toBe(42);
  });

  test('unwrapOr should return default for Err', () => {
    const result = Err(new Error('Test'));
    expect(unwrapOr(result, 0)).toBe(0);
  });

  test('mapResult should transform Ok value', () => {
    const result = Ok(42);
    const mapped = mapResult(result, (x) => x * 2);
    expect(isOk(mapped)).toBe(true);
    if (isOk(mapped)) {
      expect(mapped.value).toBe(84);
    }
  });

  test('mapResult should pass through Err', () => {
    const error = new Error('Test');
    const result = Err(error);
    const mapped = mapResult(result, (x: number) => x * 2);
    expect(isErr(mapped)).toBe(true);
    if (isErr(mapped)) {
      expect(mapped.error).toBe(error);
    }
  });

  test('mapError should transform Err error', () => {
    const result = Err(new Error('Original'));
    const mapped = mapError(result, (e) => new Error('Wrapped: ' + e.message));
    expect(isErr(mapped)).toBe(true);
    if (isErr(mapped)) {
      expect(mapped.error.message).toBe('Wrapped: Original');
    }
  });

  test('mapError should pass through Ok', () => {
    const result = Ok(42);
    const mapped = mapError(result, (e: Error) => new Error('Should not see this'));
    expect(isOk(mapped)).toBe(true);
    if (isOk(mapped)) {
      expect(mapped.value).toBe(42);
    }
  });
});
