# Conditional failed media-source attempts on D1

Source content repair and snapshot refresh call markSourceAttemptedIfMatching
when a draft or published snapshot is missing or invalid. The inherited Source
implementation uses a callback transaction that the actual Native raw-D1 adapter
refuses. Four new reached Native controls retain that failure alongside the six
previous usage controls: the first whole run is six passes and four value
failures. The distinct Native specialization now passes all ten on real D1.

Only the registered Seed D1 repository override changes. Ordinary Node callers
delegate to the original Source method. The specialization reuses inherited
pure Source row, identity, generation-match, timestamp and lease helpers. A new
attempt admits a real generation-write lease, then executes one bounded INSERT
SELECT with the actual live lease, collection and canonical-content predicates,
ON CONFLICT DO NOTHING and RETURNING. Its genuine finally block releases that
same lease. An expected source executes one UPDATE RETURNING guarded by the
full original expected snapshot and actual collection/content identity, with no
new lease. Both bodies execute through the existing owner.atomicBatch, within
100 bindings; actual returned rows determine the receipt and lost matches read
the actual current source.

Current generations, indexed timestamps, omitted optional metadata and existing
occurrences remain intact. Active and pre-activation controls both verify new
failed-source recording, stale expected receipts and durable real rows; no
Source callback, result or clock changes. Existing active-only bulk guards stay
exact. Native body atomicity and result-hook errors after commit retain the
explicit C-07 platform difference, with zero Source D1 body-identity credit.
Complete unchanged Source repair/reconciliation consumers remain separate
integration gates owned by the maintenance developer; these ten Native controls
do not establish that larger feature closure.
