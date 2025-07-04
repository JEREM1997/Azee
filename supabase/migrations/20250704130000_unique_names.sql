ALTER TABLE donut_forms
  ADD CONSTRAINT donut_forms_name_key UNIQUE (name);

ALTER TABLE donut_varieties
  ADD CONSTRAINT donut_varieties_name_key UNIQUE (name);

ALTER TABLE box_configurations
  ADD CONSTRAINT box_configurations_name_key UNIQUE (name);