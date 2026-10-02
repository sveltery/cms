import { mount } from 'svelte';
import PreviewHarness from './PreviewHarness.svelte';

mount(PreviewHarness, { target: document.getElementById('fixture')! });
