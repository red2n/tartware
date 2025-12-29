import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { API_BASE } from './api-config';
import { AdminAuthService, LoginResponse, BreakGlassResponse, ImpersonationResponse } from './admin-auth.service';

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: API_BASE, useValue: '/v1' }],
    });
    service = TestBed.inject(AdminAuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('trims empty MFA codes out of login payload', () => {
    const body = { username: 'alice', password: 'passw0rd', mfa_code: '  ', device_fingerprint: 'fp-1' };
    const mockResponse: LoginResponse = {
      access_token: 'token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'SYSTEM_ADMIN',
      session_id: 'session-1',
    };

    service.login(body).subscribe(res => expect(res).toEqual(mockResponse));

    const req = httpMock.expectOne('/v1/system/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.mfa_code).toBeUndefined();
    req.flush(mockResponse);
  });

  it('normalizes MFA code by trimming whitespace', () => {
    const body = { username: 'alice', password: 'passw0rd', mfa_code: ' 123456 ', device_fingerprint: 'fp-1' };
    const mockResponse: LoginResponse = {
      access_token: 'token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'SYSTEM_ADMIN',
      session_id: 'session-1',
    };

    service.login(body).subscribe();

    const req = httpMock.expectOne('/v1/system/auth/login');
    expect(req.request.body.mfa_code).toBe('123456');
    req.flush(mockResponse);
  });

  it('posts break-glass requests to the API', () => {
    const body = { username: 'alice', break_glass_code: 'code-123', reason: 'audit reason', ticket_id: 'INC1', device_fingerprint: 'fp-1' };
    const mockResponse: BreakGlassResponse = {
      access_token: 'token',
      token_type: 'Bearer',
      expires_in: 120,
      scope: 'SYSTEM_ADMIN',
      session_id: 'session-1',
      admin: {},
    };

    service.breakGlass(body).subscribe(res => expect(res).toEqual(mockResponse));

    const req = httpMock.expectOne('/v1/system/auth/break-glass');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(mockResponse);
  });

  it('starts impersonation sessions via the API', () => {
    const body = { tenant_id: 'tenant-1', user_id: 'user-1', reason: 'support', ticket_id: 'INC2' };
    const mockResponse: ImpersonationResponse = {
      access_token: 'impersonation-token',
      token_type: 'Bearer',
      scope: 'TENANT_IMPERSONATION',
      expires_in: 90,
    };

    service.startImpersonation(body).subscribe(res => expect(res).toEqual(mockResponse));

    const req = httpMock.expectOne('/v1/system/impersonate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(mockResponse);
  });
});
