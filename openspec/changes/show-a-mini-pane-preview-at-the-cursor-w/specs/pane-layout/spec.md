## MODIFIED Requirements

### Requirement: Pane drag feedback
Once a pane's grab strip has been dragged more than 3 px, a miniature of that pane, at most 200 px wide and copied from its current contents, with an accent border and a shadow, SHALL follow the pointer in place of a text label. The source pane SHALL dim and the pointer SHALL show grabbing everywhere until the drop or cancel, which SHALL remove all of these.

#### Scenario: Drag shows a ghost
- **WHEN** the user drags a pane's grab strip 10 px
- **THEN** a miniature of the pane follows the pointer and the source pane is dimmed

#### Scenario: Drop removes the miniature
- **WHEN** the user releases or cancels the drag
- **THEN** the miniature is gone and the source pane is no longer dimmed
