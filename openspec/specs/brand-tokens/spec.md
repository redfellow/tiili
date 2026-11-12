# brand-tokens Specification

## Purpose
The design tokens tiili's interface is drawn from, defined in `docs/brand/tiili.css` and documented in the brand README: the material palette and the project tints with their label colours.

## Requirements

### Requirement: Sixteen project tints
The design tokens SHALL define `--tint-1` to `--tint-16`, each with a `--tint-N-on` label colour, documented in the brand README in assignment order.

#### Scenario: Tokens present
- **WHEN** the app loads `docs/brand/tiili.css`
- **THEN** sixteen tints and their label colours are defined
