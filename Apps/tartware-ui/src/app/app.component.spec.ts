import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { NEVER } from 'rxjs';
import { AppComponent } from './app.component';
import { PwaService } from './core/services/pwa.service';

class MockSwUpdate {
  isEnabled = false;
  versionUpdates = NEVER;
  unrecoverable = NEVER;
  checkForUpdate = jasmine.createSpy().and.resolveTo(false);
  activateUpdate = jasmine.createSpy().and.resolveTo();
}

class MockPwaService {
  initialize(): void {
    return;
  }
}

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: SwUpdate, useClass: MockSwUpdate },
        { provide: PwaService, useClass: MockPwaService },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'tartware-ui' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('tartware-ui');
  });

  it('should render router outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
