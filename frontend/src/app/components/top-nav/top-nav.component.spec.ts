import { describe, expect, it } from 'vitest';
import { TopNavComponent } from './top-nav.component';

describe('TopNavComponent', () => {
  it('creates the component class', () => {
    const component = new TopNavComponent();
    expect(component).toBeTruthy();
  });
});
