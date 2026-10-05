# Taxonomy fixture test dependencies

The original EmDash test helper at immutable `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e` imports the genuine `pg` Pool eagerly, including when its unchanged PostgreSQL cases are skipped. The proposed development dependency is exactly `pg@8.18.0`. This enables loading that original fixture; it does not add a PostgreSQL runtime product provider or establish PostgreSQL parity.

[inventory.json](inventory.json) identifies the 14 additional lockfile package nodes, their actual licenses, and each license authority. Whole installed license files are retained. `pg-types` and `pgpass` publish their license text in README sections; those whole sections are retained verbatim. The other installed packages and original whole lock records remain unchanged. Original PostgreSQL conditional cases stay unexecuted unless their original environment is configured; no connection or identity probes were performed.
