import { i18n } from '@lingui/core';

// Exact original admin tests/setup.ts Lingui initialization at pinned913cb1bb.
// Node host has no browser renderer registration; product locale remains app-owned.
i18n.loadAndActivate({ locale: 'en', messages: {} });
