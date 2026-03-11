import { describe, expect, it } from 'vitest';
import { SiteHeaderComponent } from './site-header.component';

describe('SiteHeaderComponent', () => {
  it('creates the component class', () => {
    const component = new SiteHeaderComponent();
    expect(component).toBeTruthy();
  });
});
