// Supplemental Native DOM contracts grounded in whole Source step-remount and options-per-attempt bodies.
// Actual Svelte page and identical Original controlled API values; no real protected request/credential/clock probe.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../../parity/emdash/default-seed-setup-runtime/source/packages/admin/tests/utils/render.tsx';
import { controlledAttempts } from '../helpers/default-seed-setup/wizard-native-passkey-stop.ts';
import { beginSetup } from '../helpers/default-seed-setup/wizard-native-auth-remotes.ts';
const adminRequests: unknown[] = [];
vi.mock('../../parity/emdash/default-seed-setup-runtime/source/packages/admin/src/lib/navigation.js', () => ({ navigateTo: vi.fn() }));
vi.mock('../../parity/emdash/default-seed-setup-runtime/source/packages/admin/src/lib/api/client', async () => {
  const actual = await vi.importActual('../../parity/emdash/default-seed-setup-runtime/source/packages/admin/src/lib/api/client');
  return { ...actual, apiFetch: vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/setup/status')) return Promise.resolve(new Response(JSON.stringify({ data: { needsSetup: true, authMode: 'passkey',
      seedInfo: { name: 'Blog Template', description: 'A blog template', collections: 2, hasContent: true,
        title: 'My Awesome Blog', tagline: 'Thoughts and tutorials' } } }), { status: 200 }));
    if (url.includes('/setup/admin')) { adminRequests.push(JSON.parse(init?.body as string));
      return Promise.resolve(new Response(JSON.stringify({ data: { success: true } }), { status: 200 })); }
    if (url.includes('/setup')) return Promise.resolve(new Response(JSON.stringify({ data: { success: true, setupComplete: false } }), { status: 200 }));
    return Promise.resolve(new Response(JSON.stringify({ data: {} }), { status: 200 }));
  }) };
});
const { SetupWizard } = await import('../helpers/default-seed-setup/wizard-react.tsx');
function QueryWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
async function startAccount() {
  const screen = await render(<QueryWrapper><SetupWizard /></QueryWrapper>);
  await expect.element(screen.getByText('Set up your site')).toBeInTheDocument();
  await screen.getByText('Continue →').click();
  await expect.element(screen.getByText('Create your account')).toBeInTheDocument();
  return screen;
}
async function startSignIn() {
  const screen = await startAccount();
  await screen.getByPlaceholder('you@example.com').fill('admin@example.com');
  await screen.getByPlaceholder('Jane Doe').fill('Admin');
  await screen.getByText('Continue →').click();
  await expect.element(screen.getByText('Secure your account')).toBeInTheDocument();
  return screen;
}
describe('Native wizard presentation lifecycle', () => {
  beforeEach(() => { vi.clearAllMocks(); adminRequests.length = 0; controlledAttempts.length = 0; beginSetup.result = undefined; });
  it('returning to Site remounts its seed defaults and starting choice', async () => {
    const screen = await render(<QueryWrapper><SetupWizard /></QueryWrapper>);
    await expect.element(screen.getByText('Set up your site')).toBeInTheDocument();
    await screen.getByPlaceholder('My Awesome Blog').fill('My Custom Blog');
    await screen.getByPlaceholder('Thoughts, tutorials, and more').fill('Custom tagline');
    await screen.getByRole('radio', { name: /Empty site/ }).click();
    await screen.getByText('Continue →').click();
    await expect.element(screen.getByText('Create your account')).toBeInTheDocument();
    await screen.getByText('← Back').click();
    await expect.element(screen.getByText('Set up your site')).toBeInTheDocument();
    expect((screen.getByPlaceholder('My Awesome Blog').element() as HTMLInputElement).value).toBe('My Awesome Blog');
    expect((screen.getByPlaceholder('Thoughts, tutorials, and more').element() as HTMLInputElement).value).toBe('Thoughts and tutorials');
    await expect.element(screen.getByRole('radio', { name: /Sample content/ })).toBeChecked();
  });
  it('returning from Sign In remounts empty Account fields', async () => {
    const screen = await startSignIn();
    await screen.getByText('← Back').click();
    await expect.element(screen.getByText('Create your account')).toBeInTheDocument();
    expect((screen.getByPlaceholder('you@example.com').element() as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholder('Jane Doe').element() as HTMLInputElement).value).toBe('');
  });
  it('each controlled registration attempt prepares fresh account options before the credential boundary', async () => {
    const screen = await startSignIn();
    expect(adminRequests).toEqual([{ email: 'admin@example.com', name: 'Admin' }]);
    await screen.getByText('Create administrator and passkey').click();
    await expect.element(screen.getByText('Setup could not be completed. Please try again.')).toBeInTheDocument();
    expect(adminRequests).toEqual(Array.from({ length: 2 }, () => ({ email: 'admin@example.com', name: 'Admin' })));
    expect(controlledAttempts).toHaveLength(1);
    await screen.getByText('Create administrator and passkey').click();
    await expect.element(screen.getByText('Setup could not be completed. Please try again.')).toBeInTheDocument();
    expect(adminRequests).toEqual(Array.from({ length: 3 }, () => ({ email: 'admin@example.com', name: 'Admin' })));
    expect(controlledAttempts).toHaveLength(2);
  });
});
