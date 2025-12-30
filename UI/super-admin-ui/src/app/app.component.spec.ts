import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should expose a currentTheme signal', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    expect(app.currentTheme).toBeDefined();
    expect(app.currentTheme()).toBe('theme-light');
  });

  it('should render the shell navigation', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const navItems = Array.from(compiled.querySelectorAll('nav a')).map(el => el.textContent?.trim());
    expect(navItems).toContain('Login');
    expect(navItems).toContain('Welcome');
  });
});
