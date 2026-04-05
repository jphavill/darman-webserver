import { Component, HostListener, OnDestroy, inject, DOCUMENT } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminSessionService } from '../../core/admin/admin-session.service';

@Component({
    selector: 'app-top-nav',
    imports: [RouterLink, RouterLinkActive, FormsModule],
    templateUrl: './top-nav.component.html',
    styleUrls: ['./top-nav.component.css']
})
export class TopNavComponent implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly adminSession = inject(AdminSessionService);

  readonly isAuthenticated = this.adminSession.isAuthenticated;
  readonly isLoggingIn = this.adminSession.isLoggingIn;
  readonly loginError = this.adminSession.loginError;
  readonly logoutError = this.adminSession.logoutError;

  loginModalOpen = false;
  apiTokenInput = '';

  openLoginModal(): void {
    this.loginModalOpen = true;
    this.apiTokenInput = '';
    this.adminSession.clearLoginError();
    this.document.body.classList.add('overlay-open');
  }

  closeLoginModal(): void {
    this.loginModalOpen = false;
    this.apiTokenInput = '';
    this.adminSession.clearLoginError();
    this.document.body.classList.remove('overlay-open');
  }

  submitLogin(event: Event): void {
    event.preventDefault();

    this.adminSession.login(this.apiTokenInput).subscribe((isLoggedIn) => {
      if (isLoggedIn) {
        this.closeLoginModal();
      }
    });
  }

  logout(): void {
    this.adminSession.logout();
    this.closeLoginModal();
  }

  logoutFromBadge(): void {
    this.adminSession.logout();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.loginModalOpen) {
      this.closeLoginModal();
    }
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('overlay-open');
  }
}
