# Review criteria

Besides tracing every behavior to the change's spec, hold the change to these. Each one broken is a change to make.

## Safety

- Nothing weakens how the workspace handles secrets, credentials or user data.
- No automated test reaches a real outside service.

## Compatibility

- Stored data, public APIs and file formats stay readable by the previous version, or the change says how they move.

## Words

- Text a person reads (UI, messages, errors) is plain and specific: it says what happened and what can be done.
