# tests/

`test_direct.py` runs `contracts/grantvault.py` under the GenVM SDK in direct mode (pinned to v0.2.16).

`fixtures/` holds two real responses captured from registry.npmjs.org on 2026-10-18:

- `is_odd_packument.json`: the package-level document `GET /is-odd` (readme and user lists stripped).
  This is the only document that carries the `time` map the contract relies on.
- `is_odd_3.0.1_version_doc.json`: the version-level document `GET /is-odd/3.0.1`. It has no `time` field,
  which is why the contract reads the package-level document instead.
