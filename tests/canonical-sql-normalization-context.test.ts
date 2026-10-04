// Original grammar-context requirements, separate from copied Source evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMigrationSql } from '../src/lib/server/database/migration-provider.ts';

test('arbitrary generated field identifiers retain historical quote equivalence', () => {
  assert.equal(normalizeMigrationSql('"story_body" TEXT DEFAULT \'a  b\''),
    normalizeMigrationSql('story_body TEXT DEFAULT \'a  b\''));
});
test('arbitrary generated fields retain quote equivalence in a complete table', () => {
  assert.equal(normalizeMigrationSql('CREATE TABLE "ec_story" ("story_body" TEXT, "headline_custom" JSON)'),
    normalizeMigrationSql('CREATE TABLE ec_story (story_body TEXT, headline_custom JSON)'));
});
test('a default matching a known column name retains double-quoted literal bytes', () => {
  assert.notEqual(normalizeMigrationSql('CREATE TABLE _cms_options (name TEXT DEFAULT "name")'),
    normalizeMigrationSql('CREATE TABLE _cms_options (name TEXT DEFAULT name)'));
});
test('a known schema name in a quoted SELECT expression retains literal bytes', () => {
  assert.notEqual(normalizeMigrationSql('SELECT "_cms_options"'), normalizeMigrationSql('SELECT _cms_options'));
});
