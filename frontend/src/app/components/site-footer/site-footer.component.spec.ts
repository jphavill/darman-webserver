import { describe, expect, it } from 'vitest';
import { SiteFooterComponent } from './site-footer.component';

describe('SiteFooterComponent', () => {
  it('creates the component class', () => {
    const component = new SiteFooterComponent();
    expect(component).toBeTruthy();
  });
});
