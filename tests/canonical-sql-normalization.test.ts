// Original schema-comparison requirements; no copied Source test credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMigrationSql } from '../src/lib/server/database/migration-provider.ts';

test('canonical schema comparison retains embedded double quotes in single-quoted defaults', () => {
  assert.notEqual(normalizeMigrationSql(`CREATE TABLE sample (value TEXT DEFAULT '"manual"')`),
    normalizeMigrationSql(`CREATE TABLE sample (value TEXT DEFAULT 'manual')`));
});
test('canonical schema comparison distinguishes a double-quoted timestamp literal from the expression', () => {
  assert.notEqual(normalizeMigrationSql('CREATE TABLE sample (created_at TEXT DEFAULT "CURRENT_TIMESTAMP")'),
    normalizeMigrationSql('CREATE TABLE sample (created_at TEXT DEFAULT CURRENT_TIMESTAMP)'));
});
test('canonical schema comparison preserves whitespace inside single-quoted defaults', () => {
  assert.notEqual(normalizeMigrationSql(`CREATE TABLE sample (value TEXT DEFAULT 'a  b')`),
    normalizeMigrationSql(`CREATE TABLE sample (value TEXT DEFAULT 'a b')`));
});
test('canonical schema comparison preserves doubled single quotes and enclosed whitespace', () => {
  assert.notEqual(normalizeMigrationSql(`CREATE TABLE sample (value TEXT DEFAULT 'it''s  here')`),
    normalizeMigrationSql(`CREATE TABLE sample (value TEXT DEFAULT 'it''s here')`));
});
test('canonical schema comparison preserves Unicode nonbreaking whitespace outside literals', () => {
  assert.notEqual(normalizeMigrationSql('CREATE TABLE sample (value TEXT\u00a0NOT NULL)'),
    normalizeMigrationSql('CREATE TABLE sample (value TEXT NOT NULL)'));
});
test('canonical schema comparison preserves vertical-tab token boundaries outside literals', () => {
  assert.notEqual(normalizeMigrationSql('CREATE TABLE sample (value TEXT\u000bNOT NULL)'),
    normalizeMigrationSql('CREATE TABLE sample (value TEXT NOT NULL)'));
});
test('canonical schema comparison still accepts known quoted native identifiers and SQLite ASCII whitespace', () => {
  assert.equal(normalizeMigrationSql('CREATE TABLE "_cms_fields" ("id" TEXT, "collection_id" TEXT)\n'),
    normalizeMigrationSql('CREATE\tTABLE _cms_fields (id TEXT, collection_id TEXT)'));
});
