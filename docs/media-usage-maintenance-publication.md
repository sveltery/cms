# Maintenance publication history

GitHub transport published ordinary commits with the exact original Native trees and message text, preserving ordered ancestry with mapped first parents. Public commit SHAs, author/committer identities and dates differ from the original Native commits. The complete original Native Git history remains in the isolated worktree; no reset, force update, squash or rebase occurred. GitHub API message presentation omits the terminal newline even for the prior public Native commit.

| Original Native commit | Actual public commit | Exact tree |
| --- | --- | --- |
| `79e6a2f30501c7e42a1902d9d9a6ae143ceb7007` | `be3e2863cd22313cc4525bbd1ac1e5b23fb7cffe` | `78bb769253a912dd023be3fe2eab9d08215be98e` |
| `30d3ed098a9830c1846f21d43a6d98bb3cc744cc` | `b9ed6bb502a7e45439252da804434bf4804c7a13` | `27aaba6c2b0b619b6d6906b734e578c7d376778b` |
| `849ca9763156d186e1f29afa6e9bef2146361f0a` | `009cdfa52c5eeae12ab361461a4100d6848dad22` | `db526842f7ffebf2c63143ac6095ec39d6efaeda` |
| `71296cc7bb6b5d7f8b7d5e7f4ec693de45973d4a` | `2bbd231e756a16276140ed349759eccb79cf63e8` | `4e16b1e6ac799018eb7b8165b5c0f4d2f7c76bc8` |
| `1e46cde94fb43dbca5a00b92eee6e75f3994dc8d` | `0d8a06886e2b540b106f1eccae4e2f62262b00a9` | `da816be9a977641aef105ee222bba022030eeaef` |
| `8a83b5e36af7dc0e9c22e15ffb1c5256bb33106c` | `24e5a3d936a9a2f52e319df5107794a91bfdb762` | `a20067d6c8f54e5ce8499fff451dcfa382d4b7d3` |
| `6815c7fec54ed0d900885c30a224004f7ef7f1b2` | `0c03000f387005caa130db785553713de448ffb5` | `c6d0daa2dd89c39b49d6797d64541bcf3d076f72` |

The current actual public PR #123 head is `0c03000f387005caa130db785553713de448ffb5`, tree `c6d0daa2dd89c39b49d6797d64541bcf3d076f72`. All 24 new blob objects, seven created trees and actual ordered public commit headers were verified before the owned branch advanced with an expected-head check and `force:false`.

This publication is a development handoff. The Source Workerd reference witness carries zero Native parity credit. Native repair's three conditional consequences still stop at the snapshot-read prerequisite; their producer association is held. The new Native front phase test-first checkpoint is separate from this seven-commit publication, and the front implementation remains a review draft.
