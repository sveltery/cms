import * as React from 'react';
import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { FieldEditor } from '../helpers/schema-ui/FieldEditor';
it('opens the actual native modal and returns its cancellation request on Escape', async () => {
  const onOpenChange = vi.fn();
  const screen = await render(<FieldEditor open onOpenChange={onOpenChange} onSave={vi.fn()} field={{slug:'title',label:'Title',type:'string'}} />);
  await expect.element(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByRole('dialog').element().matches(':modal')).toBe(true);
  expect(screen.getByRole('dialog').element().contains(document.activeElement)).toBe(true);
  await userEvent.keyboard('{Escape}');
  await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});
