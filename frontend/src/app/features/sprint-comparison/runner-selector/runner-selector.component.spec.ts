import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { RunnerSelectorComponent } from './runner-selector.component';

describe('RunnerSelectorComponent', () => {
  const createComponent = (): RunnerSelectorComponent => TestBed.runInInjectionContext(() => new RunnerSelectorComponent());

  it('filters runners by search term', () => {
    const component = createComponent();
    component.runners = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ];
    component.searchTerm = 'ali';

    expect(component.filteredRunners).toEqual([{ id: 1, name: 'Alice' }]);
  });

  it('emits add and clears search for an exact match', () => {
    const component = createComponent();
    component.runners = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ];
    component.searchTerm = 'alice';
    component.dropdownOpen = true;

    const addSpy = vi.spyOn(component.addRunner, 'emit');
    const searchSpy = vi.spyOn(component.searchTermChange, 'emit');

    component.addFromSearch();

    expect(addSpy).toHaveBeenCalledWith({ id: 1, name: 'Alice' });
    expect(searchSpy).toHaveBeenCalledWith('');
    expect(component.dropdownOpen).toBe(false);
  });

  it('does not emit when candidate is already selected', () => {
    const component = createComponent();
    component.runners = [{ id: 1, name: 'Alice' }];
    component.selectedPersonIds = [1];
    component.searchTerm = 'alice';

    const addSpy = vi.spyOn(component.addRunner, 'emit');

    component.addFromSearch();

    expect(addSpy).not.toHaveBeenCalled();
  });

  it('adds candidate when pressing Enter', () => {
    const component = createComponent();
    component.runners = [{ id: 1, name: 'Alice' }];
    component.searchTerm = 'alice';

    const addSpy = vi.spyOn(component.addRunner, 'emit');
    const event = { preventDefault: vi.fn() } as unknown as KeyboardEvent;

    component.onEnterKey(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledWith({ id: 1, name: 'Alice' });
  });
});
