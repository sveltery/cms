# Native media picker

This feature targets EmDash 1.1.0 media picker, multi-selection and inline uploads at immutable pin `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`. The three complete source suites and selected complete component/API helpers are retained byte-for-byte with MIT attribution in [the source manifest](media-picker-source.json). All 53 declarations are initially unexecuted; copied inventory earns no passing or test-first assertion-red credit.

The production UI will use a native Svelte modal and actual provider9 media endpoints. React/query/Lingui source rendering requires an explicit test-only host substitution, whose acceptance is not recorded. Actual provider plugins, cropping, image optimization and usage maintenance remain owned by separate features. Current development parent is public media PR59 `5ea75a941324d86db225416b64425e5f602425a7`; final integration requires approved main/provider9 and complete unchanged normal and secured checks.
